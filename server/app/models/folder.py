"""
Folder / Project Category Data Model
"""

from typing import List, TYPE_CHECKING
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .workflow import WorkflowORM


class FolderORM(Base, TimestampMixin):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_expanded: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    workflows: Mapped[List["WorkflowORM"]] = relationship(
        "WorkflowORM",
        back_populates="folder",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<FolderORM(id={self.id}, name={self.name})>"
