"""
RESTful API Endpoints for Knowledge Base Management (CRUD)
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.knowledge import DocumentORM, KnowledgeBaseORM
from app.schemas.knowledge import (
    DocumentResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseSummaryResponse,
    KnowledgeBaseUpdate,
    RetrievalRequest,
    RetrievalResponse,
)
from app.services.rag.retriever import vector_retriever

logger = logging.getLogger("patchcat.api.knowledge")
router = APIRouter()


@router.get(
    "",
    response_model=List[KnowledgeBaseSummaryResponse],
    summary="List all knowledge bases",
    description="Retrieve list of all knowledge bases with document and chunk counts.",
)
async def list_knowledge_bases(
    search: Optional[str] = Query(None, description="Search by knowledge base name"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeBaseORM).order_by(desc(KnowledgeBaseORM.created_at))
    if search:
        stmt = stmt.where(KnowledgeBaseORM.name.ilike(f"%{search.strip()}%"))

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=KnowledgeBaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new knowledge base",
    description="Create a new knowledge base collection for storing documents and vector embeddings.",
)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
):
    kb_data = payload.model_dump()
    kb = KnowledgeBaseORM(**kb_data)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    logger.info("Created KnowledgeBase id=%s name='%s'", kb.id, kb.name)
    return kb


@router.get(
    "/{kb_id}",
    response_model=KnowledgeBaseResponse,
    summary="Get knowledge base details",
    description="Retrieve a single knowledge base by its unique ID.",
)
async def get_knowledge_base(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )
    return kb


@router.put(
    "/{kb_id}",
    response_model=KnowledgeBaseResponse,
    summary="Update knowledge base",
    description="Update metadata or indexing configuration of an existing knowledge base.",
)
async def update_knowledge_base(
    kb_id: str,
    payload: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kb, field, value)

    await db.commit()
    await db.refresh(kb)
    logger.info("Updated KnowledgeBase id=%s", kb_id)
    return kb


@router.delete(
    "/{kb_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete knowledge base",
    description="Permanently delete a knowledge base and cascade-delete all associated documents and chunks.",
)
async def delete_knowledge_base(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    result = await db.execute(stmt)
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )

    await db.delete(kb)
    await db.commit()
    logger.info("Deleted KnowledgeBase id=%s and all its documents", kb_id)
    return None


@router.get(
    "/{kb_id}/documents",
    response_model=List[DocumentResponse],
    summary="List documents in knowledge base",
    description="Retrieve all documents associated with a specific knowledge base.",
)
async def list_kb_documents(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Verify KB exists
    kb_stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
    kb_res = await db.execute(kb_stmt)
    if not kb_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base '{kb_id}' not found",
        )

    stmt = select(DocumentORM).where(DocumentORM.kb_id == kb_id).order_by(desc(DocumentORM.created_at))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/{kb_id}/retrieve",
    response_model=RetrievalResponse,
    summary="Retrieve relevant chunks from knowledge base",
    description="Vectorize user query and perform semantic similarity search against knowledge base chunks.",
)
async def retrieve_from_knowledge_base(
    kb_id: str,
    payload: RetrievalRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await vector_retriever.retrieve(
            db=db,
            kb_id=kb_id,
            query=payload.query,
            top_k=payload.top_k,
            score_threshold=payload.score_threshold,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
