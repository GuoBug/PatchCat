"""
Tests for Workflow Execution API (POST /api/v1/workflows/{id}/run)
Covers:
1. Direct synchronous execution with token calculation
2. Branch skipping and condition routing on server
3. 403 Forbidden when API is disabled
4. 401 Unauthorized with invalid or missing API key
5. 404 Not Found for non-existent workflow
6. SSE streaming execution endpoint
"""

import pytest
from httpx import AsyncClient

SAMPLE_ROUTING_GRAPH = {
    "nodes": [
        {
            "id": "in_1",
            "type": "input",
            "data": {
                "label": "Input",
                "inputs": {"category": "billing", "query": "Need invoice refund"}
            }
        },
        {
            "id": "cond_1",
            "type": "condition",
            "data": {
                "label": "Router",
                "config": {
                    "conditions": [
                        {
                            "id": "r_tech",
                            "variable": "category",
                            "operator": "equals",
                            "value": "tech",
                            "targetHandle": "branch_tech"
                        },
                        {
                            "id": "r_billing",
                            "variable": "category",
                            "operator": "equals",
                            "value": "billing",
                            "targetHandle": "branch_billing"
                        }
                    ],
                    "defaultBranch": "branch_general"
                },
                "inputs": {"category": "{{in_1.category}}"}
            }
        },
        {
            "id": "prompt_tech",
            "type": "prompt",
            "data": {
                "label": "Tech Prompt",
                "inputs": {"template": "Tech: {{in_1.query}}"}
            }
        },
        {
            "id": "prompt_billing",
            "type": "prompt",
            "data": {
                "label": "Billing Prompt",
                "inputs": {"template": "Billing: {{in_1.query}}"}
            }
        },
        {
            "id": "agg_1",
            "type": "aggregator",
            "data": {
                "label": "Aggregator",
                "config": {
                    "mode": "first_available",
                    "outputKey": "selected"
                },
                "inputs": {
                    "t": "{{prompt_tech.promptText}}",
                    "b": "{{prompt_billing.promptText}}"
                }
            }
        }
    ],
    "edges": [
        {"id": "e1", "source": "in_1", "target": "cond_1"},
        {"id": "e2", "source": "cond_1", "sourceHandle": "branch_tech", "target": "prompt_tech"},
        {"id": "e3", "source": "cond_1", "sourceHandle": "branch_billing", "target": "prompt_billing"},
        {"id": "e4", "source": "prompt_tech", "target": "agg_1"},
        {"id": "e5", "source": "prompt_billing", "target": "agg_1"}
    ]
}


@pytest.mark.asyncio
async def test_workflow_run_api_disabled_returns_403(client: AsyncClient):
    """Should return 403 when api_enabled is false."""
    create_res = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Unpublished Workflow",
            "graph": SAMPLE_ROUTING_GRAPH,
        },
    )
    assert create_res.status_code == 201
    wf_id = create_res.json()["id"]

    run_res = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"inputs": {}},
    )
    assert run_res.status_code == 403
    assert "not enabled" in run_res.json()["detail"]


@pytest.mark.asyncio
async def test_workflow_run_invalid_api_key_returns_401(client: AsyncClient):
    """Should return 401 when API key is required but invalid or missing."""
    create_res = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Key Protected Workflow",
            "graph": SAMPLE_ROUTING_GRAPH,
        },
    )
    wf_id = create_res.json()["id"]

    # Enable API with an API key
    await client.put(
        f"/api/v1/workflows/{wf_id}",
        json={
            "api_enabled": True,
            "api_key": "secret-key-123456",
        },
    )

    # 1. Missing header
    res_no_key = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"inputs": {}},
    )
    assert res_no_key.status_code == 401

    # 2. Invalid header
    res_bad_key = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        headers={"Authorization": "Bearer wrong-key"},
        json={"inputs": {}},
    )
    assert res_bad_key.status_code == 401


@pytest.mark.asyncio
async def test_workflow_run_sync_execution_success(client: AsyncClient):
    """Synchronous execution with condition routing, skipping and aggregator."""
    create_res = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Live Routing Workflow",
            "nodes": SAMPLE_ROUTING_GRAPH["nodes"],
            "edges": SAMPLE_ROUTING_GRAPH["edges"],
        },
    )
    wf_id = create_res.json()["id"]

    # Enable API
    await client.put(
        f"/api/v1/workflows/{wf_id}",
        json={
            "api_enabled": True,
            "api_key": "test-key-999",
        },
    )

    run_res = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        headers={"Authorization": "Bearer test-key-999"},
        json={"inputs": {"category": "billing", "query": "Please refund order 999"}},
    )

    assert run_res.status_code == 200
    data = run_res.json()
    assert data["workflow_id"] == wf_id
    assert data["status"] == "completed"
    assert "prompt_billing" in data["outputs"]
    assert "prompt_tech" not in data["outputs"]  # Tech was skipped!
    assert "agg_1" in data["outputs"]
    assert data["token_usage"]["total"] >= 0
    assert data["duration_ms"] >= 0


@pytest.mark.asyncio
async def test_workflow_run_404_not_found(client: AsyncClient):
    """Returns 404 for unknown workflow."""
    res = await client.post(
        "/api/v1/workflows/unknown-wf-id/run",
        json={"inputs": {}},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_workflow_run_streaming_sse(client: AsyncClient):
    """SSE streaming execution yields SSE data chunks."""
    create_res = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Streaming Workflow",
            "graph": SAMPLE_ROUTING_GRAPH,
        },
    )
    wf_id = create_res.json()["id"]

    await client.put(
        f"/api/v1/workflows/{wf_id}",
        json={"api_enabled": True},
    )

    res = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"inputs": {"category": "billing", "query": "Need help"}, "stream": True},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    text = res.text
    assert "WORKFLOW_START" in text
    assert "WORKFLOW_COMPLETE" in text
