"""
Pydantic v2 Schemas for Folder & Project Category
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Folder name")
    is_expanded: bool = Field(default=True, description="Whether folder is expanded in sidebar")


class FolderCreate(FolderBase):
    id: Optional[str] = Field(None, max_length=64, description="Optional custom ID")


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_expanded: Optional[bool] = None


class FolderResponse(FolderBase):
    id: str
    is_preset: bool
    created_at: datetime
    updated_at: datetime
    workflow_count: int = Field(default=0, description="Total number of workflows in this folder")

    model_config = ConfigDict(from_attributes=True)
