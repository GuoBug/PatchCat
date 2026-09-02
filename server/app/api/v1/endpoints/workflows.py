"""
Workflow Management Endpoints (List, Get, Create, Update, Duplicate, Move, Delete)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from nanoid import generate

from ....core.database import get_db
from ....models.workflow import WorkflowORM
from ....models.folder import FolderORM
from ....schemas.workflow import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowSummaryResponse,
    MoveWorkflowRequest,
)

router = APIRouter()


@router.get("", response_model=List[WorkflowSummaryResponse], summary="List Workflows")
async def list_workflows(
    folder_id: Optional[str] = Query(None, description="Filter by folder ID"),
    search: Optional[str] = Query(None, description="Search by workflow name"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves workflow summaries matching optional filters.
    """
    stmt = select(WorkflowORM).order_by(WorkflowORM.updated_at.desc())

    if folder_id:
        stmt = stmt.where(WorkflowORM.folder_id == folder_id)

    if search:
        stmt = stmt.where(WorkflowORM.name.ilike(f"%{search}%"))

    result = await db.execute(stmt)
    workflows = result.scalars().all()

    summaries = []
    for wf in workflows:
        summaries.append(
            WorkflowSummaryResponse(
                id=wf.id,
                name=wf.name,
                folder_id=wf.folder_id,
                description=wf.description,
                node_count=len(wf.nodes) if isinstance(wf.nodes, list) else 0,
                edge_count=len(wf.edges) if isinstance(wf.edges, list) else 0,
                is_preset=wf.is_preset,
                created_at=wf.created_at,
                updated_at=wf.updated_at,
            )
        )

    return summaries


@router.get("/{workflow_id}", response_model=WorkflowResponse, summary="Get Full Workflow Graph")
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieves complete workflow graph with full node parameters and edges.
    """
    wf = await db.get(WorkflowORM, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    return wf


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED, summary="Create Workflow")
async def create_workflow(wf_in: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    """
    Creates a new workflow.
    """
    wf_id = wf_in.id or f"wf_{generate(size=10)}"

    existing = await db.get(WorkflowORM, wf_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workflow with ID '{wf_id}' already exists",
        )

    # If folder_id specified, verify folder exists
    if wf_in.folder_id:
        folder = await db.get(FolderORM, wf_in.folder_id)
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target folder '{wf_in.folder_id}' does not exist",
            )

    wf = WorkflowORM(
        id=wf_id,
        name=wf_in.name,
        folder_id=wf_in.folder_id,
        description=wf_in.description,
        nodes=wf_in.nodes,
        edges=wf_in.edges,
        global_inputs=wf_in.global_inputs,
        is_preset=False,
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.put("/{workflow_id}", response_model=WorkflowResponse, summary="Update / Auto-save Workflow")
async def update_workflow(
    workflow_id: str,
    wf_in: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Updates workflow graph nodes, edges, or metadata.
    """
    wf = await db.get(WorkflowORM, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    if wf_in.name is not None:
        wf.name = wf_in.name
    if wf_in.folder_id is not None:
        wf.folder_id = wf_in.folder_id
    if wf_in.description is not None:
        wf.description = wf_in.description
    if wf_in.nodes is not None:
        wf.nodes = wf_in.nodes
    if wf_in.edges is not None:
        wf.edges = wf_in.edges
    if wf_in.global_inputs is not None:
        wf.global_inputs = wf_in.global_inputs

    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/{workflow_id}/duplicate", response_model=WorkflowResponse, summary="Duplicate Workflow")
async def duplicate_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Creates an exact duplicate copy of a workflow.
    """
    source = await db.get(WorkflowORM, workflow_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    new_id = f"wf_{generate(size=10)}"
    copy_wf = WorkflowORM(
        id=new_id,
        name=f"{source.name} (Copy)",
        folder_id=source.folder_id,
        description=source.description,
        nodes=source.nodes,
        edges=source.edges,
        global_inputs=source.global_inputs,
        is_preset=False,
    )
    db.add(copy_wf)
    await db.commit()
    await db.refresh(copy_wf)
    return copy_wf


@router.post("/{workflow_id}/move", response_model=WorkflowResponse, summary="Move Workflow to Folder")
async def move_workflow(
    workflow_id: str,
    req: MoveWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Moves a workflow to another destination folder.
    """
    wf = await db.get(WorkflowORM, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    folder = await db.get(FolderORM, req.target_folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target folder '{req.target_folder_id}' not found",
        )

    wf.folder_id = req.target_folder_id
    await db.commit()
    await db.refresh(wf)
    return wf


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Workflow")
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Deletes a workflow by ID.
    """
    wf = await db.get(WorkflowORM, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{workflow_id}' not found",
        )

    await db.delete(wf)
    await db.commit()
    return None
