"""
Workflow Graph Data Model (Nodes, Edges, Configurations)
"""

from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .folder import FolderORM

# Use JSONB on PostgreSQL, fallback to standard JSON on SQLite for tests
JSON_TYPE = JSONB().with_variant(JSON(), "sqlite")


class WorkflowORM(Base, TimestampMixin):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    folder_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Graph DAG primitives
    nodes: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON_TYPE,
        default=list,
        nullable=False,
    )
    edges: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON_TYPE,
        default=list,
        nullable=False,
    )
    global_inputs: Mapped[Dict[str, Any]] = mapped_column(
        JSON_TYPE,
        default=dict,
        nullable=False,
    )

    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    folder: Mapped[Optional["FolderORM"]] = relationship(
        "FolderORM",
        back_populates="workflows",
    )

    def __repr__(self) -> str:
        return f"<WorkflowORM(id={self.id}, name={self.name}, folder_id={self.folder_id})>"
