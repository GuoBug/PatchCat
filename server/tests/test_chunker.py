"""
Integration Tests for Text Cleaner, Chunker Engine, and Document Chunk Endpoints (Phase 2 - Step 2)
"""

import pytest
from httpx import AsyncClient

from app.services.rag.cleaner import clean_document_text
from app.services.rag.chunker import TextChunker, estimate_tokens


def test_text_cleaner_transformations():
    """Verify document cleaner handles carriage returns, tabs, and excess newlines."""
    dirty_text = "Line 1\r\n\r\n\r\n\r\nLine 2\twith   extra   spaces\n\n\nLine 3"
    cleaned = clean_document_text(dirty_text)

    # 4 consecutive newlines compressed to 2
    assert "\r" not in cleaned
    assert "\t" not in cleaned
    assert "Line 1\n\nLine 2 with extra spaces\n\nLine 3" == cleaned


def test_estimate_tokens():
    """Verify token count heuristic for mixed text."""
    # Chinese text
    zh_text = "PatchCat 提示流编排器"
    tokens = estimate_tokens(zh_text)
    assert tokens >= 7

    # English text
    en_text = "Hello world, this is a test prompt flow"
    tokens_en = estimate_tokens(en_text)
    assert tokens_en >= 8


def test_chunker_sliding_window_overlap():
    """Verify sliding window chunker splits long paragraphs with overlap."""
    chunker = TextChunker(chunk_size=100, chunk_overlap=20, delimiter="\n\n")

    p1 = "First paragraph containing important technical context for LLMs."
    p2 = "Second paragraph explaining how topological Kahn sorting executes nodes."
    p3 = "Third paragraph detailing how pgvector stores dense vector embeddings."

    full_text = f"{p1}\n\n{p2}\n\n{p3}"
    chunks = chunker.split_text(full_text)

    assert len(chunks) >= 3
    for i, c in enumerate(chunks):
        assert c.position == i
        assert len(c.content) <= 120  # bounds check
        assert c.token_count > 0


@pytest.mark.asyncio
async def test_preview_chunks_api(client: AsyncClient):
    """Verify POST /api/v1/preview-chunks endpoint returns correct preview."""
    payload = {
        "content": (
            "Dify is an open-source LLM app development platform.\n\n"
            "Its intuitive interface combines AI workflow, RAG pipeline, agent capabilities, and model management.\n\n"
            "PatchCat brings visual prompt flow orchestration to local environments."
        ),
        "delimiter": "\n\n",
        "chunk_size": 120,
        "chunk_overlap": 20,
        "clean_whitespace": True,
    }

    res = await client.post("/api/v1/preview-chunks", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["total_characters"] > 0
    assert data["total_chunks"] >= 2
    assert data["estimated_tokens"] > 0
    assert len(data["chunks"]) == data["total_chunks"]
    assert data["chunks"][0]["position"] == 0


@pytest.mark.asyncio
async def test_document_crud_and_chunk_persistence(client: AsyncClient):
    """Verify document upload, automated chunking, chunk retrieval, and cascade deletion."""
    # 1. Create a Knowledge Base
    kb_res = await client.post(
        "/api/v1/knowledge-bases",
        json={
            "name": "Docs Knowledge Base",
            "embedding_provider": "openai",
            "embedding_model": "text-embedding-3-small",
        },
    )
    assert kb_res.status_code == 201
    kb_id = kb_res.json()["id"]

    # 2. Upload and chunk document into this KB
    doc_content = (
        "PatchCat Architecture Manual Section 1:\n"
        "The system uses Kahn's algorithm for directed acyclic graph topological sorting.\n\n"
        "Section 2:\n"
        "StorageAdapter pattern decouples UI from LocalStorage and FastAPI backend.\n\n"
        "Section 3:\n"
        "RAG pipeline segments documents into chunks and calculates cosine similarity."
    )
    doc_res = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/documents",
        json={
            "name": "architecture.md",
            "content": doc_content,
            "file_extension": ".md",
            "chunk_size": 120,
            "chunk_overlap": 20,
        },
    )
    assert doc_res.status_code == 201
    doc = doc_res.json()
    doc_id = doc["id"]
    assert doc["name"] == "architecture.md"
    assert doc["chunk_count"] >= 2
    assert doc["status"] == "completed"

    # 3. Verify KB updated counts
    kb_detail = (await client.get(f"/api/v1/knowledge-bases/{kb_id}")).json()
    assert kb_detail["document_count"] == 1
    assert kb_detail["total_chunks"] == doc["chunk_count"]

    # 4. Get Document Detail
    doc_detail = (await client.get(f"/api/v1/documents/{doc_id}")).json()
    assert doc_detail["id"] == doc_id

    # 5. List Document Chunks
    chunks_res = await client.get(f"/api/v1/documents/{doc_id}/chunks")
    assert chunks_res.status_code == 200
    chunks = chunks_res.json()
    assert len(chunks) == doc["chunk_count"]
    assert chunks[0]["doc_id"] == doc_id
    assert chunks[0]["position"] == 0

    # 6. Delete Document
    del_res = await client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 204

    # 7. Verify KB counts decremented
    kb_after_del = (await client.get(f"/api/v1/knowledge-bases/{kb_id}")).json()
    assert kb_after_del["document_count"] == 0
    assert kb_after_del["total_chunks"] == 0

    # Clean up KB
    await client.delete(f"/api/v1/knowledge-bases/{kb_id}")
