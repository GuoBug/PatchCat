"""
Workflow Execution REST API Endpoints (Synchronous JSON & Streaming SSE)
"""

import json
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.database import get_db
from ....models.workflow import WorkflowORM
from ....schemas.workflow import WorkflowRunRequest, WorkflowRunResponse
from ....services.workflow_runner import run_workflow

router = APIRouter()


@router.post("/{workflow_id}/run", summary="Run Workflow via REST API")
async def execute_published_workflow(
    workflow_id: str,
    req: WorkflowRunRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes a saved workflow graph via HTTP.
    Supports synchronous JSON responses and real-time Server-Sent Events (SSE).
    """
    wf = await db.get(WorkflowORM, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    # 1. Check if API publishing is enabled
    if not wf.api_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workflow API execution is not enabled. Please enable it in the Publish API settings.",
        )

    # 2. Check API Key if configured
    if wf.api_key:
        provided_key = req.api_key or x_api_key
        if not provided_key and authorization and authorization.startswith("Bearer "):
            provided_key = authorization[7:]

        if provided_key != wf.api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing API key for this workflow endpoint.",
            )

    wf_dict = {
        "id": wf.id,
        "nodes": wf.nodes or [],
        "edges": wf.edges or [],
        "global_inputs": wf.global_inputs or {},
    }

    # 3. Stream Mode (SSE)
    if req.stream:
        async def sse_event_generator():
            yield f"data: {json.dumps({'type': 'WORKFLOW_START', 'workflow_id': workflow_id, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
            await asyncio.sleep(0.01)

            outputs, token_usage, duration_ms = await run_workflow(wf_dict, req.inputs)

            # Stream chunks
            yield f"data: {json.dumps({'type': 'NODE_CHUNK', 'delta': 'Execution in progress...', 'fullContent': 'Executing workflow DAG'})}\n\n"
            await asyncio.sleep(0.01)

            yield f"data: {json.dumps({'type': 'WORKFLOW_COMPLETE', 'workflow_id': workflow_id, 'outputs': outputs, 'token_usage': token_usage, 'duration_ms': duration_ms})}\n\n"

        return StreamingResponse(sse_event_generator(), media_type="text/event-stream")

    # 4. Synchronous Mode (JSON)
    outputs, token_usage, duration_ms = await run_workflow(wf_dict, req.inputs)

    return WorkflowRunResponse(
        workflow_id=workflow_id,
        status="completed",
        outputs=outputs,
        token_usage=token_usage,
        duration_ms=duration_ms,
        created_at=datetime.utcnow(),
    )
