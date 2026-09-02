"""
System Health Check Endpoint
"""

from fastapi import APIRouter
from ....core.config import settings
from ....core.database import ping_db

router = APIRouter()


@router.get("/health", summary="Service Health & DB Connectivity Check")
async def health_check():
    """
    Returns system health status, version, environment, and database connection state.
    """
    is_db_healthy = await ping_db()

    return {
        "status": "healthy" if is_db_healthy else "degraded",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "database_connected": is_db_healthy,
    }
