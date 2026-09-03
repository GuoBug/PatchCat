"""
Pydantic v2 Schemas for Knowledge Base, Documents, and Chunks (RAG Pipeline)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# 1. Knowledge Base Schemas
# ─────────────────────────────────────────────────────────────────────────────

class KnowledgeBaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Knowledge base name")
    description: Optional[str] = Field(None, description="Detailed description of knowledge domain")
    embedding_provider: str = Field("openai", description="Embedding provider (openai, siliconflow, ollama)")
    embedding_model: str = Field("text-embedding-3-small", description="Model used for generating embeddings")
    embedding_dimension: int = Field(1536, description="Vector dimension size")
    index_technique: Dict[str, Any] = Field(default_factory=dict, description="Indexing settings")


class KnowledgeBaseCreate(KnowledgeBaseBase):
    id: Optional[str] = Field(None, max_length=64, description="Optional custom ID")


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    embedding_provider: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    index_technique: Optional[Dict[str, Any]] = None


class KnowledgeBaseSummaryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int
    document_count: int
    total_chunks: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: str
    document_count: int
    total_chunks: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Document Schemas
# ─────────────────────────────────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Document filename")
    content: str = Field(..., min_length=1, description="Raw document text content")
    file_extension: str = Field(".txt", description="File extension (.txt, .md, .pdf)")
    chunk_size: int = Field(500, ge=50, le=4000, description="Max chunk size in characters")
    chunk_overlap: int = Field(50, ge=0, le=1000, description="Overlap in characters")


class ChunkPreviewRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Raw document text content to preview")
    delimiter: str = Field("\n\n", description="Primary paragraph delimiter")
    chunk_size: int = Field(500, ge=50, le=4000, description="Max chunk size in characters")
    chunk_overlap: int = Field(50, ge=0, le=1000, description="Overlap in characters")
    clean_whitespace: bool = Field(True, description="Whether to normalize consecutive newlines and spaces")


class ChunkPreviewItem(BaseModel):
    position: int
    content: str
    char_count: int
    token_count: int


class ChunkPreviewResponse(BaseModel):
    total_characters: int
    total_chunks: int
    estimated_tokens: int
    chunks: List[ChunkPreviewItem]


class DocumentResponse(BaseModel):
    id: str
    kb_id: str
    name: str
    file_extension: str
    file_size: int
    char_count: int
    chunk_count: int
    status: str
    chunk_size: int
    chunk_overlap: int
    error_msg: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Document Chunk Schemas
# ─────────────────────────────────────────────────────────────────────────────

class DocumentChunkResponse(BaseModel):
    id: str
    kb_id: str
    doc_id: str
    position: int
    content: str
    token_count: int
    hit_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Retrieval Request & Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class RetrievalRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User query to search against knowledge base")
    top_k: int = Field(3, ge=1, le=20, description="Number of most similar chunks to return")
    score_threshold: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity score")


class RetrievedChunk(BaseModel):
    id: str
    doc_id: str
    doc_name: Optional[str] = None
    position: int
    content: str
    score: float
    token_count: int


class RetrievalResponse(BaseModel):
    query: str
    knowledge_base_id: str
    top_k: int
    score_threshold: float
    total_recalled: int
    context: str = Field(..., description="Markdown-formatted concatenated context string")
    chunks: List[RetrievedChunk]
