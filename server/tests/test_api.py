"""
Comprehensive REST API Integration Tests
Testing Health, Folders CRUD, Workflows CRUD, Duplication, and Re-organization
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verify system healthcheck returns 200 OK."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data
    assert "app_name" in data


@pytest.mark.asyncio
async def test_folder_crud(client: AsyncClient):
    """Verify folder creation, list, update, and deletion."""
    # 1. Create Folder
    create_res = await client.post(
        "/api/v1/folders",
        json={"name": "Customer Support Automation", "is_expanded": True},
    )
    assert create_res.status_code == 201
    folder = create_res.json()
    assert folder["name"] == "Customer Support Automation"
    folder_id = folder["id"]

    # 2. List Folders
    list_res = await client.get("/api/v1/folders")
    assert list_res.status_code == 200
    folders = list_res.json()
    assert len(folders) == 1
    assert folders[0]["id"] == folder_id

    # 3. Update Folder
    update_res = await client.put(
        f"/api/v1/folders/{folder_id}",
        json={"name": "Smart Customer Support", "is_expanded": False},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Smart Customer Support"
    assert updated["is_expanded"] is False

    # 4. Delete Folder
    del_res = await client.delete(f"/api/v1/folders/{folder_id}")
    assert del_res.status_code == 204

    # Verify deleted
    list_res2 = await client.get("/api/v1/folders")
    assert len(list_res2.json()) == 0


@pytest.mark.asyncio
async def test_workflow_crud_and_operations(client: AsyncClient):
    """Verify workflow creation, update, duplication, moving, and deletion."""
    # 1. Create Folders for testing
    f1 = (await client.post("/api/v1/folders", json={"name": "Folder A"})).json()
    f2 = (await client.post("/api/v1/folders", json={"name": "Folder B"})).json()

    # 2. Create Workflow
    wf_payload = {
        "name": "Refund Routing Flow",
        "folder_id": f1["id"],
        "description": "Multi-agent intent classification",
        "nodes": [
            {
                "id": "input_1",
                "type": "input",
                "position": {"x": 100, "y": 100},
                "data": {"label": "User Query", "inputs": {"text": "I want a refund"}},
            },
            {
                "id": "llm_1",
                "type": "llm",
                "position": {"x": 400, "y": 100},
                "data": {"label": "Classifier", "config": {"model": "gpt-4o"}},
            },
        ],
        "edges": [
            {
                "id": "edge_1",
                "source": "input_1",
                "target": "llm_1",
            }
        ],
        "global_inputs": {"env": "production"},
    }

    create_res = await client.post("/api/v1/workflows", json=wf_payload)
    assert create_res.status_code == 201
    wf = create_res.json()
    assert wf["name"] == "Refund Routing Flow"
    assert len(wf["nodes"]) == 2
    assert len(wf["edges"]) == 1
    wf_id = wf["id"]

    # 3. List Workflows (Summary)
    list_res = await client.get(f"/api/v1/workflows?folder_id={f1['id']}")
    assert list_res.status_code == 200
    summaries = list_res.json()
    assert len(summaries) == 1
    assert summaries[0]["node_count"] == 2

    # 4. Get Full Workflow
    get_res = await client.get(f"/api/v1/workflows/{wf_id}")
    assert get_res.status_code == 200
    assert get_res.json()["nodes"][0]["id"] == "input_1"

    # 5. Update Workflow (Auto-save)
    update_res = await client.put(
        f"/api/v1/workflows/{wf_id}",
        json={"name": "Refund Routing Flow (v2)", "global_inputs": {"env": "staging"}},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Refund Routing Flow (v2)"

    # 6. Duplicate Workflow
    dup_res = await client.post(f"/api/v1/workflows/{wf_id}/duplicate")
    assert dup_res.status_code == 200
    dup_wf = dup_res.json()
    assert dup_wf["name"] == "Refund Routing Flow (v2) (Copy)"
    assert dup_wf["id"] != wf_id
    assert len(dup_wf["nodes"]) == 2

    # 7. Move Workflow to Folder B
    move_res = await client.post(
        f"/api/v1/workflows/{wf_id}/move",
        json={"target_folder_id": f2["id"]},
    )
    assert move_res.status_code == 200
    assert move_res.json()["folder_id"] == f2["id"]

    # 8. Delete Workflow
    del_res = await client.delete(f"/api/v1/workflows/{wf_id}")
    assert del_res.status_code == 204

    # Verify 404 on get
    get_res2 = await client.get(f"/api/v1/workflows/{wf_id}")
    assert get_res2.status_code == 404
