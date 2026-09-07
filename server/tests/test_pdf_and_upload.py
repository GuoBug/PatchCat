"""
Tests for document file uploads (TXT, MD, PDF) and chunk active toggling.
"""

from io import BytesIO
import pytest
from httpx import AsyncClient
from pypdf import PdfWriter


@pytest.mark.asyncio
async def test_upload_txt_and_toggle_chunk(client: AsyncClient):
    # 1. Create a Knowledge Base
    kb_resp = await client.post(
        "/api/v1/knowledge-bases",
        json={
            "name": "Upload Test KB",
            "description": "Testing multipart file uploads and toggling",
            "embedding_provider": "local",
            "embedding_model": "deterministic",
            "embedding_dimension": 64,
        },
    )
    assert kb_resp.status_code == 201
    kb_id = kb_resp.json()["id"]

    # 2. Upload a Markdown file
    md_content = b"# System Manual\n\nPatchCat is an agentic AI prompt orchestrator.\n\nIt features DAG execution and RAG retrieval."
    files = {"file": ("manual.md", md_content, "text/markdown")}
    data = {"chunk_size": "100", "chunk_overlap": "20"}

    upload_resp = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/upload",
        files=files,
        data=data,
    )
    assert upload_resp.status_code == 201
    doc_data = upload_resp.json()
    assert doc_data["name"] == "manual.md"
    assert doc_data["file_extension"] == "md"
    assert doc_data["chunk_count"] > 0
    doc_id = doc_data["id"]

    # 3. List chunks for this document
    chunks_resp = await client.get(f"/api/v1/documents/{doc_id}/chunks")
    assert chunks_resp.status_code == 200
    chunks = chunks_resp.json()
    assert len(chunks) > 0
    target_chunk = chunks[0]
    chunk_id = target_chunk["id"]
    assert target_chunk["is_active"] is True

    # 4. Toggle chunk active state to False
    toggle_resp = await client.patch(f"/api/v1/chunks/{chunk_id}/toggle")
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # 5. Toggle chunk explicitly back to True
    toggle_resp2 = await client.patch(
        f"/api/v1/chunks/{chunk_id}/toggle",
        params={"is_active": True},
    )
    assert toggle_resp2.status_code == 200
    assert toggle_resp2.json()["is_active"] is True

    # 6. Toggle back to False and verify retrieval omits it
    await client.patch(
        f"/api/v1/chunks/{chunk_id}/toggle",
        params={"is_active": False},
    )

    # Retrieve
    retrieve_resp = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/retrieve",
        json={"query": "agentic prompt orchestrator", "top_k": 5},
    )
    assert retrieve_resp.status_code == 200
    results = retrieve_resp.json()["chunks"]
    retrieved_ids = [c["id"] for c in results]
    assert chunk_id not in retrieved_ids


@pytest.mark.asyncio
async def test_upload_empty_file_fails(client: AsyncClient):
    kb_resp = await client.post(
        "/api/v1/knowledge-bases",
        json={"name": "Empty Test KB"},
    )
    assert kb_resp.status_code == 201
    kb_id = kb_resp.json()["id"]

    files = {"file": ("empty.txt", b"   \n  \n  ", "text/plain")}
    upload_resp = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/upload",
        files=files,
    )
    assert upload_resp.status_code == 400


@pytest.mark.asyncio
async def test_upload_blank_and_corrupt_pdf(client: AsyncClient):
    kb_resp = await client.post(
        "/api/v1/knowledge-bases",
        json={"name": "PDF Validation KB"},
    )
    assert kb_resp.status_code == 201
    kb_id = kb_resp.json()["id"]

    # 1. Blank PDF without text
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = BytesIO()
    writer.write(buf)
    files = {"file": ("blank.pdf", buf.getvalue(), "application/pdf")}
    upload_resp = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/upload",
        files=files,
    )
    assert upload_resp.status_code == 400
    assert "no readable text" in upload_resp.json()["detail"]

    # 2. Corrupt PDF
    corrupt_files = {"file": ("corrupt.pdf", b"%PDF-corrupt garbage...", "application/pdf")}
    corrupt_resp = await client.post(
        f"/api/v1/knowledge-bases/{kb_id}/upload",
        files=corrupt_files,
    )
    assert corrupt_resp.status_code == 422
