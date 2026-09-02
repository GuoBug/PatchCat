"""
SQLAlchemy 2.0 Async Database Connection Pool & Session Management
"""

import logging
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from .config import settings
from ..models.base import Base

logger = logging.getLogger("patchcat.database")

# Create Async Engine
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session per request.
    Automatically closes the session upon request completion.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables on application startup."""
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension if connected to PostgreSQL
            if "postgresql" in settings.DATABASE_URL:
                try:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    logger.info("Successfully ensured 'vector' extension exists in PostgreSQL.")
                except Exception as ext_err:
                    logger.warning(f"Could not enable 'vector' extension (may require superuser or not PG): {ext_err}")

            # Create all tables defined in Base.metadata
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema synchronized successfully.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        # In development without Postgres running, don't crash startup immediately
        if settings.APP_ENV != "production":
            logger.warning("Continuing startup in degraded mode (DB not reachable).")
        else:
            raise


async def ping_db() -> bool:
    """Ping database to test live connectivity."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.warning(f"Database ping failed: {e}")
        return False
