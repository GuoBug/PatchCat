"""
RESTful API Endpoints for Document Upload, Preprocessing, Chunking, and Preview
"""

import logging
import os
from io import BytesIO
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.knowledge import DocumentChunkORM, DocumentORM, KnowledgeBaseORM
from app.schemas.knowledge import (
    ChunkPreviewItem,
    ChunkPreviewRequest,
    ChunkPreviewResponse,
    DocumentChunkResponse,
    DocumentCreate,
    DocumentResponse,
)
from app.services.rag.chunker import TextChunker, estimate_tokens
from app.services.rag.cleaner import clean_document_text
from app.services.rag.embedder import embedding_client

logger = logging.getLogger("patchcat.api.documents")
router = APIRouter()


@router.post(
    "/preview-chunks",
    response_model=ChunkPreviewResponse,
    summary="Preview text chunking",
    description="Pre-clean text and preview chunks with token estimation without saving to database.",
)
async def preview_chunks(payload: ChunkPreviewRequest):
    raw_text = payload.content
    if payload.clean_whitespace:
        cleaned_text = clean_document_text(raw_text)
    else:
        cleaned_text = raw_text.strip()

    chunker = TextChunker(
        chunk_size=payload.chunk_size,
        chunk_overlap=payload.chunk_overlap,
        delimiter=payload.delimiter,
    )
    raw_chunks = chunker.split_text(cleaned_text)

    preview_items = [
        ChunkPreviewItem(
            position=item.position,
            content=item.content,
            char_count=item.char_count,
            token_count=item.token_count,
        )
        for item in raw_chunks
    ]

    total_tokens = sum(item.token_count for item in preview_items)

    return ChunkPreviewResponse(
        total_characters=len(cleaned_text),
        total_chunks=len(preview_items),
        estimated_tokens=total_tokens,
        chunks=preview_items,
    )


@router.post(
    "/knowledge-bases/{kb_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create document and generate chunks",
    description="Clean, chunk, and index a new document into the specified knowledge base.",
)
async def create_document(
    kb_id: str,
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify Knowledge Base exists
    kb_stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    kb_res = await db.execute(kb_stmt)
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )

    # Clean text
    cleaned_text = clean_document_text(payload.content)
    char_count = len(cleaned_text)

    # Chunk text
    chunker = TextChunker(
        chunk_size=payload.chunk_size,
        chunk_overlap=payload.chunk_overlap,
    )
    generated_chunks = chunker.split_text(cleaned_text)

    # Create Document record
    doc = DocumentORM(
        kb_id=kb_id,
        name=payload.name.strip(),
        file_extension=payload.file_extension,
        file_size=len(payload.content.encode("utf-8")),
        char_count=char_count,
        chunk_count=len(generated_chunks),
        status="completed",
        chunk_size=payload.chunk_size,
        chunk_overlap=payload.chunk_overlap,
    )
    db.add(doc)
    await db.flush()  # populate doc.id

    # Generate embeddings for generated chunks
    chunk_texts = [item.content for item in generated_chunks]
    embeddings = await embedding_client.embed_documents(
        texts=chunk_texts,
        provider=kb.embedding_provider,
        model=kb.embedding_model,
        dimension=kb.embedding_dimension,
    )

    # Create DocumentChunk records
    for chunk_item, emb in zip(generated_chunks, embeddings):
        chunk_orm = DocumentChunkORM(
            kb_id=kb_id,
            doc_id=doc.id,
            position=chunk_item.position,
            content=chunk_item.content,
            token_count=chunk_item.token_count,
            embedding=emb,
            hit_count=0,
            is_active=True,
        )
        db.add(chunk_orm)

    # Update KnowledgeBase cached metrics
    kb.document_count += 1
    kb.total_chunks += len(generated_chunks)

    await db.commit()
    await db.refresh(doc)
    logger.info(
        "Indexed Document '%s' (id=%s) into KB '%s' with %d chunks",
        doc.name,
        doc.id,
        kb_id,
        len(generated_chunks),
    )
    return doc


@router.get(
    "/documents/{doc_id}",
    response_model=DocumentResponse,
    summary="Get document details",
    description="Retrieve document metadata by document ID.",
)
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DocumentORM).where(DocumentORM.id == doc_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found",
        )
    return doc


@router.get(
    "/documents/{doc_id}/chunks",
    response_model=List[DocumentChunkResponse],
    summary="List document chunks",
    description="Retrieve all text chunks belonging to a document.",
)
async def list_document_chunks(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Verify Document exists
    doc_stmt = select(DocumentORM).where(DocumentORM.id == doc_id)
    doc_res = await db.execute(doc_stmt)
    if not doc_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found",
        )

    stmt = (
        select(DocumentChunkORM)
        .where(DocumentChunkORM.doc_id == doc_id)
        .order_by(DocumentChunkORM.position)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.delete(
    "/documents/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete document and its chunks",
    description="Cascade delete a document and all of its associated chunks.",
)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DocumentORM).where(DocumentORM.id == doc_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found",
        )

    # Decrement parent KB counts
    kb_stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == doc.kb_id)
    kb_res = await db.execute(kb_stmt)
    kb = kb_res.scalar_one_or_none()
    if kb:
        kb.document_count = max(0, kb.document_count - 1)
        kb.total_chunks = max(0, kb.total_chunks - doc.chunk_count)

    await db.delete(doc)
    await db.commit()
    logger.info("Deleted Document id=%s and its chunks", doc_id)
    return None


@router.patch(
    "/chunks/{chunk_id}/toggle",
    response_model=DocumentChunkResponse,
    summary="Toggle or set chunk active status",
    description="Enable or disable a specific document chunk from semantic retrieval.",
)
async def toggle_chunk_active(
    chunk_id: str,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DocumentChunkORM).where(DocumentChunkORM.id == chunk_id)
    res = await db.execute(stmt)
    chunk = res.scalar_one_or_none()
    if not chunk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chunk '{chunk_id}' not found",
        )

    if is_active is None:
        chunk.is_active = not chunk.is_active
    else:
        chunk.is_active = is_active

    await db.commit()
    await db.refresh(chunk)
    logger.info("Toggled chunk %s is_active=%s", chunk_id, chunk.is_active)
    return chunk


@router.post(
    "/knowledge-bases/{kb_id}/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload document file (PDF, TXT, MD) and index into knowledge base",
    description="Extract text from uploaded file, clean, chunk, embed, and index into knowledge base.",
)
async def upload_document_file(
    kb_id: str,
    file: UploadFile = File(...),
    chunk_size: int = Form(500),
    chunk_overlap: int = Form(50),
    db: AsyncSession = Depends(get_db),
):
    # Verify Knowledge Base exists
    kb_stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    kb_res = await db.execute(kb_stmt)
    kb = kb_res.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )

    filename = file.filename or "uploaded_doc"
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower().lstrip(".")

    file_bytes = await file.read()
    raw_text = ""

    if ext_lower == "pdf":
        try:
            reader = PdfReader(BytesIO(file_bytes))
            pages_text = [page.extract_text() or "" for page in reader.pages]
            raw_text = "\n\n".join(pages_text)
        except Exception as e:
            logger.error("Failed to parse PDF file '%s': %s", filename, e)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to parse PDF document: {str(e)}",
            )
    else:
        # Default text/markdown decoding
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1", errors="replace")

    cleaned_text = clean_document_text(raw_text)
    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file contains no readable text content.",
        )

    # Chunk text
    chunker = TextChunker(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    generated_chunks = chunker.split_text(cleaned_text)

    # Create Document record
    doc = DocumentORM(
        kb_id=kb_id,
        name=filename,
        file_extension=ext_lower or "txt",
        file_size=len(file_bytes),
        char_count=len(cleaned_text),
        chunk_count=len(generated_chunks),
        status="completed",
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    db.add(doc)
    await db.flush()

    # Generate embeddings
    chunk_texts = [item.content for item in generated_chunks]
    embeddings = await embedding_client.embed_documents(
        texts=chunk_texts,
        provider=kb.embedding_provider,
        model=kb.embedding_model,
        dimension=kb.embedding_dimension,
    )

    # Create DocumentChunk records
    for chunk_item, emb in zip(generated_chunks, embeddings):
        chunk_orm = DocumentChunkORM(
            kb_id=kb_id,
            doc_id=doc.id,
            position=chunk_item.position,
            content=chunk_item.content,
            token_count=chunk_item.token_count,
            embedding=emb,
            hit_count=0,
            is_active=True,
        )
        db.add(chunk_orm)

    # Update KnowledgeBase cached metrics
    kb.document_count += 1
    kb.total_chunks += len(generated_chunks)

    await db.commit()
    await db.refresh(doc)
    logger.info(
        "Uploaded & Indexed file '%s' (id=%s) into KB '%s' with %d chunks",
        doc.name,
        doc.id,
        kb_id,
        len(generated_chunks),
    )
    return doc

