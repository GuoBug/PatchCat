"""
Integration Tests for Knowledge Base REST API (Phase 2 - Step 1)
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_knowledge_base_crud(client: AsyncClient):
    """Verify Knowledge Base creation, retrieval, listing, updating, and deletion."""
    # 1. Create Knowledge Base
    create_res = await client.post(
        "/api/v1/knowledge-bases",
        json={
            "name": "PatchCat Architecture Manual",
            "description": "Technical documentation and design specifications",
            "embedding_provider": "openai",
            "embedding_model": "text-embedding-3-small",
            "embedding_dimension": 1536,
            "index_technique": {"mode": "vector", "score_threshold": 0.5},
        },
    )
    assert create_res.status_code == 201
    kb = create_res.json()
    assert kb["name"] == "PatchCat Architecture Manual"
    assert kb["embedding_provider"] == "openai"
    assert kb["embedding_dimension"] == 1536
    assert kb["document_count"] == 0
    assert kb["total_chunks"] == 0
    kb_id = kb["id"]

    # 2. List Knowledge Bases
    list_res = await client.get("/api/v1/knowledge-bases")
    assert list_res.status_code == 200
    kbs = list_res.json()
    assert len(kbs) >= 1
    assert any(k["id"] == kb_id for k in kbs)

    # 3. Search Knowledge Bases
    search_res = await client.get("/api/v1/knowledge-bases?search=Architecture")
    assert search_res.status_code == 200
    matched = search_res.json()
    assert len(matched) == 1
    assert matched[0]["id"] == kb_id

    # 4. Get Knowledge Base Detail
    get_res = await client.get(f"/api/v1/knowledge-bases/{kb_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == kb_id

    # 5. Update Knowledge Base
    update_res = await client.put(
        f"/api/v1/knowledge-bases/{kb_id}",
        json={
            "name": "PatchCat Production Guide",
            "embedding_dimension": 1024,
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "PatchCat Production Guide"
    assert updated["embedding_dimension"] == 1024

    # 6. List documents in empty KB
    docs_res = await client.get(f"/api/v1/knowledge-bases/{kb_id}/documents")
    assert docs_res.status_code == 200
    assert len(docs_res.json()) == 0

    # 7. Delete Knowledge Base
    del_res = await client.delete(f"/api/v1/knowledge-bases/{kb_id}")
    assert del_res.status_code == 204

    # 8. Verify 404 on deleted KB
    not_found = await client.get(f"/api/v1/knowledge-bases/{kb_id}")
    assert not_found.status_code == 404
