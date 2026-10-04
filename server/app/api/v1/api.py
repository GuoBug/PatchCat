"""
API v1 Router Aggregator
"""

from fastapi import APIRouter, Depends
from ...core.security import require_api_token
from .endpoints import health, folders, workflows, knowledge, documents, workflow_run

api_router = APIRouter()
protected = [Depends(require_api_token)]

# Healthcheck (always open for liveness probes)
api_router.include_router(health.router, tags=["Health"])

# Workflow execution carries its own per-workflow API key, so it is not behind the global token.
api_router.include_router(workflow_run.router, prefix="/workflows", tags=["Workflow Execution"])

# Folders & Projects
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"], dependencies=protected)

# Workflows & Graphs
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"], dependencies=protected)

# Knowledge Base & RAG
api_router.include_router(
    knowledge.router, prefix="/knowledge-bases", tags=["Knowledge Bases"], dependencies=protected
)

# Documents & Chunks
api_router.include_router(documents.router, tags=["Documents"], dependencies=protected)
