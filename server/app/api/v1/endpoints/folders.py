"""
Folders & Category Management Endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from nanoid import generate

from ....core.database import get_db
from ....models.folder import FolderORM
from ....models.workflow import WorkflowORM
from ....schemas.folder import FolderCreate, FolderUpdate, FolderResponse

router = APIRouter()


@router.get("", response_model=List[FolderResponse], summary="List All Folders")
async def list_folders(db: AsyncSession = Depends(get_db)):
    """
    Retrieves all folders along with their workflow counts.
    """
    # Query folders with count of related workflows
    stmt = (
        select(
            FolderORM,
            func.count(WorkflowORM.id).label("workflow_count"),
        )
        .outerjoin(WorkflowORM, FolderORM.id == WorkflowORM.folder_id)
        .group_by(FolderORM.id)
        .order_by(FolderORM.created_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    response_list = []
    for folder, count in rows:
        resp = FolderResponse(
            id=folder.id,
            name=folder.name,
            is_expanded=folder.is_expanded,
            is_preset=folder.is_preset,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
            workflow_count=count,
        )
        response_list.append(resp)

    return response_list


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED, summary="Create a New Folder")
async def create_folder(folder_in: FolderCreate, db: AsyncSession = Depends(get_db)):
    """
    Creates a new folder category.
    """
    folder_id = folder_in.id or f"folder_{generate(size=8)}"

    # Check if ID already exists
    existing = await db.get(FolderORM, folder_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Folder with ID '{folder_id}' already exists",
        )

    folder = FolderORM(
        id=folder_id,
        name=folder_in.name,
        is_expanded=folder_in.is_expanded,
        is_preset=False,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        is_expanded=folder.is_expanded,
        is_preset=folder.is_preset,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        workflow_count=0,
    )


@router.put("/{folder_id}", response_model=FolderResponse, summary="Update Folder")
async def update_folder(
    folder_id: str,
    folder_in: FolderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Updates folder name or expanded state.
    """
    folder = await db.get(FolderORM, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder '{folder_id}' not found",
        )

    if folder_in.name is not None:
        folder.name = folder_in.name
    if folder_in.is_expanded is not None:
        folder.is_expanded = folder_in.is_expanded

    await db.commit()
    await db.refresh(folder)

    # Count workflows
    count_stmt = select(func.count(WorkflowORM.id)).where(WorkflowORM.folder_id == folder_id)
    count_res = await db.execute(count_stmt)
    workflow_count = count_res.scalar() or 0

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        is_expanded=folder.is_expanded,
        is_preset=folder.is_preset,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        workflow_count=workflow_count,
    )


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Folder")
async def delete_folder(folder_id: str, db: AsyncSession = Depends(get_db)):
    """
    Deletes a folder and cascades/moves workflows.
    """
    folder = await db.get(FolderORM, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder '{folder_id}' not found",
        )

    if folder.is_preset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete built-in preset folder",
        )

    await db.delete(folder)
    await db.commit()
    return None
