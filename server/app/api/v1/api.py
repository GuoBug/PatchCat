"""
API v1 Router Aggregator
"""

from fastapi import APIRouter
from .endpoints import health, folders, workflows, knowledge, documents

api_router = APIRouter()

# Healthcheck
api_router.include_router(health.router, tags=["Health"])

# Folders & Projects
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])

# Workflows & Graphs
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])

# Knowledge Base & RAG
api_router.include_router(knowledge.router, prefix="/knowledge-bases", tags=["Knowledge Bases"])

# Documents & Chunks
api_router.include_router(documents.router, tags=["Documents"])
