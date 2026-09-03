"""
Integration Tests for Embedding Vectorization and Semantic Retrieval (Phase 2 - Step 3)
"""

import math
import pytest
from httpx import AsyncClient

from app.services.rag.embedder import generate_deterministic_embedding
from app.services.rag.retriever import cosine_similarity


def test_deterministic_embedding_properties():
    """Verify generated embeddings have expected dimensions and unit norm."""
    vec1536 = generate_deterministic_embedding("PatchCat Prompt Orchestrator", dimension=1536)
    assert len(vec1536) == 1536

    # Unit norm check: ||v|| ≈ 1.0
    norm = math.sqrt(sum(x * x for x in vec1536))
    assert abs(norm - 1.0) < 1e-4

    # Semantic similarity check: texts with shared words should have higher similarity
    vec_a = generate_deterministic_embedding("Directed acyclic graph topological sorting", dimension=1536)
    vec_b = generate_deterministic_embedding("Topological sorting of graph nodes with Kahn algorithm", dimension=1536)
    vec_c = generate_deterministic_embedding("Chocolate ice cream strawberry dessert recipe", dimension=1536)

    sim_ab = cosine_similarity(vec_a, vec_b)
    sim_ac = cosine_similarity(vec_a, vec_c)

    assert sim_ab > sim_ac, f"Expected sim(A, B)={sim_ab} > sim(A, C)={sim_ac}"


def test_cosine_similarity_edge_cases():
    """Verify cosine similarity mathematical boundary values."""
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == -1.0
    assert cosine_similarity([], []) == 0.0


@pytest.mark.asyncio
async def test_end_to_end_rag_retrieval(client: AsyncClient):
    """
    Test full RAG loop:
    1. Create Knowledge Base
    2. Upload Document A (Algorithm) & Document B (Database)
    3. Query for Algorithm -> Verify Doc A recalled first
    4. Verify Markdown context formatting and hit_count increment
    """
    # 1. Create Knowledge Base
    kb_res = await client.post(
        "/api/v1/knowledge-bases",
        json={
            "name": "PatchCat Architecture Corpus",
            "embedding_provider": "openai",
            "embedding_model": "text-embedding-3-small",
            "embedding_dimension": 1536,
        },
    )
    assert kb_res.status_code == 201
    kb_id = kb_res.json()["id"]

    # 2. Upload Document A (Topological Sorting)
    doc_a_res = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/documents",
        json={
            "name": "topological_scheduler.md",
            "content": (
                "PatchCat utilizes Kahn's algorithm for directed acyclic graph topological sorting.\n\n"
                "Nodes with zero in-degree are identified and executed in parallel asynchronous waves.\n\n"
                "If in-flight cycles are detected, execution halts with a cyclic dependency error."
            ),
            "file_extension": ".md",
            "chunk_size": 200,
            "chunk_overlap": 30,
        },
    )
    assert doc_a_res.status_code == 201
    doc_a = doc_a_res.json()
    assert doc_a["chunk_count"] >= 1

    # 3. Upload Document B (Vector Database)
    doc_b_res = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/documents",
        json={
            "name": "vector_database.md",
            "content": (
                "PostgreSQL pgvector extension provides dense vector indexing via HNSW and IVFFlat.\n\n"
                "Embeddings with 1536 dimensions are indexed using cosine distance operators.\n\n"
                "For local zero-docker development, SQLite stores JSON float arrays with numpy similarity."
            ),
            "file_extension": ".md",
            "chunk_size": 200,
            "chunk_overlap": 30,
        },
    )
    assert doc_b_res.status_code == 201
    doc_b = doc_b_res.json()

    # 4. Perform Retrieval query related to Topological Kahn Algorithm
    query_res = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/retrieve",
        json={
            "query": "How does Kahn algorithm perform directed acyclic graph scheduling?",
            "top_k": 2,
            "score_threshold": 0.0,
        },
    )
    assert query_res.status_code == 200
    retrieval = query_res.json()

    assert retrieval["knowledge_base_id"] == kb_id
    assert retrieval["total_recalled"] >= 1
    chunks = retrieval["chunks"]
    assert len(chunks) <= 2

    # Verify top result is from Document A (topological_scheduler.md)
    top_chunk = chunks[0]
    assert top_chunk["doc_name"] == "topological_scheduler.md"
    assert top_chunk["score"] > 0.0

    # Verify context string contains Markdown source citation
    assert "### [Document: topological_scheduler.md" in retrieval["context"]

    # 5. Check hit_count was incremented on Document A chunks
    chunks_detail = (await client.get(f"/api/v1/documents/{doc_a['id']}/chunks")).json()
    recalled_chunk_ids = [c["id"] for c in chunks]
    for c in chunks_detail:
        if c["id"] in recalled_chunk_ids:
            assert c["hit_count"] >= 1

    # 6. Test Score Threshold Filtering
    strict_res = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/retrieve",
        json={
            "query": "How does Kahn algorithm perform directed acyclic graph scheduling?",
            "top_k": 2,
            "score_threshold": 0.9999,  # Unreasonably high threshold should filter everything
        },
    )
    assert strict_res.status_code == 200
    strict_data = strict_res.json()
    assert strict_data["total_recalled"] == 0
    assert len(strict_data["chunks"]) == 0

    # Clean up
    await client.delete(f"/api/v1/knowledge-bases/{kb_id}")
