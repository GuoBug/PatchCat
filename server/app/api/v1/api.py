"""
API v1 Router Aggregator
"""

from fastapi import APIRouter
from .endpoints import health, folders, workflows

api_router = APIRouter()

# Healthcheck
api_router.include_router(health.router, tags=["Health"])

# Folders & Projects
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])

# Workflows & Graphs
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])
