"""
Pydantic v2 Schemas for Workflow DAG (Nodes, Edges, Configurations)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Workflow title")
    folder_id: Optional[str] = Field(None, max_length=64, description="Parent folder identifier")
    description: Optional[str] = Field(None, description="Optional markdown description")
    nodes: List[Dict[str, Any]] = Field(default_factory=list, description="Array of DAG nodes with coordinates")
    edges: List[Dict[str, Any]] = Field(default_factory=list, description="Array of directed DAG edges")
    global_inputs: Dict[str, Any] = Field(default_factory=dict, description="Default global runtime input variables")


class WorkflowCreate(WorkflowBase):
    id: Optional[str] = Field(None, max_length=64, description="Optional custom workflow ID")


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_id: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    global_inputs: Optional[Dict[str, Any]] = None


class WorkflowSummaryResponse(BaseModel):
    id: str
    name: str
    folder_id: Optional[str]
    description: Optional[str]
    node_count: int
    edge_count: int
    is_preset: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowResponse(WorkflowBase):
    id: str
    is_preset: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MoveWorkflowRequest(BaseModel):
    target_folder_id: str = Field(..., description="Destination folder ID")
