"""
Pydantic v2 Schemas for Workflow DAG (Nodes, Edges, Configurations)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Workflow title")
    folder_id: Optional[str] = Field(None, max_length=64, description="Parent folder identifier")
    description: Optional[str] = Field(None, description="Optional markdown description")
    nodes: List[Dict[str, Any]] = Field(default_factory=list, description="Array of DAG nodes with coordinates")
    edges: List[Dict[str, Any]] = Field(default_factory=list, description="Array of directed DAG edges")
    global_inputs: Dict[str, Any] = Field(default_factory=dict, description="Default global runtime input variables")
    api_enabled: bool = Field(default=False, description="Whether REST API execution is enabled")
    api_key: Optional[str] = Field(None, max_length=128, description="API authorization key")


class WorkflowCreate(WorkflowBase):
    id: Optional[str] = Field(None, max_length=64, description="Optional custom workflow ID")


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_id: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    global_inputs: Optional[Dict[str, Any]] = None
    api_enabled: Optional[bool] = None
    api_key: Optional[str] = None


class WorkflowSummaryResponse(BaseModel):
    id: str
    name: str
    folder_id: Optional[str]
    description: Optional[str]
    node_count: int
    edge_count: int
    is_preset: bool
    api_enabled: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowResponse(WorkflowBase):
    id: str
    is_preset: bool
    created_at: datetime
    updated_at: datetime
    api_key: Optional[str] = Field(
        default=None,
        exclude=True,
        description="Plaintext API key excluded from serialization for access security",
    )
    api_key_masked: Optional[str] = Field(
        default=None,
        description="Masked API key representation for UI display (e.g. pk_live_***abcd)",
    )

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def compute_masked_key(self) -> "WorkflowResponse":
        if self.api_key:
            raw = str(self.api_key).strip()
            if len(raw) > 10:
                self.api_key_masked = f"{raw[:6]}...{raw[-4:]}"
            elif len(raw) > 0:
                self.api_key_masked = "***"
        return self


class MoveWorkflowRequest(BaseModel):
    target_folder_id: str = Field(..., description="Destination folder ID")


class WorkflowRunRequest(BaseModel):
    inputs: Dict[str, Any] = Field(default_factory=dict, description="Input variables mapping")
    stream: bool = Field(default=False, description="Enable SSE event streaming")
    api_key: Optional[str] = Field(None, description="Optional API key for authorization")


class WorkflowRunResponse(BaseModel):
    workflow_id: str
    status: str
    execution_mode: str = Field(
        default="simulated",
        description="Execution mode: 'simulated' (dry-run topology & variable validation) or 'live'",
    )
    outputs: Dict[str, Any] = Field(default_factory=dict)
    token_usage: Dict[str, int] = Field(default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0})
    duration_ms: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

