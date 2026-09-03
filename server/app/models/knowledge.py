"""
SQLAlchemy 2.0 ORM Models for Knowledge Base, Documents, and Chunks (RAG Pipeline)
"""

import uuid
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .base import Base, TimestampMixin


def generate_uuid() -> str:
    return str(uuid.uuid4())


class KnowledgeBaseORM(Base, TimestampMixin):
    """
    Knowledge Base Collection (Corpus for RAG retrieval).
    Top-level container for related documents and vector embeddings.
    """
    __tablename__ = "knowledge_bases"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=generate_uuid,
        doc="Unique identifier for knowledge base (UUID/nanoid)",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Knowledge base display name",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Optional markdown description of corpus domain",
    )
    embedding_provider: Mapped[str] = mapped_column(
        String(64),
        default="openai",
        nullable=False,
        doc="Provider for embedding generation (openai, siliconflow, ollama)",
    )
    embedding_model: Mapped[str] = mapped_column(
        String(128),
        default="text-embedding-3-small",
        nullable=False,
        doc="Specific model name used for vectorization",
    )
    embedding_dimension: Mapped[int] = mapped_column(
        Integer,
        default=1536,
        nullable=False,
        doc="Vector embedding dimensional size (e.g. 1536, 1024, 768)",
    )
    index_technique: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
        doc="Indexing and retrieval configuration (search_mode, score_threshold, etc.)",
    )
    document_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Cached total number of active documents",
    )
    total_chunks: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Cached total number of vector chunks",
    )

    # Relationships
    documents: Mapped[List["DocumentORM"]] = relationship(
        "DocumentORM",
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    chunks: Mapped[List["DocumentChunkORM"]] = relationship(
        "DocumentChunkORM",
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<KnowledgeBaseORM id={self.id} name={self.name} docs={self.document_count}>"


class DocumentORM(Base, TimestampMixin):
    """
    Document item within a knowledge base.
    Represents an uploaded or synchronized source file (TXT, MD, PDF).
    """
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=generate_uuid,
        doc="Unique document identifier",
    )
    kb_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Parent knowledge base reference",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Original file name (e.g. guide.md)",
    )
    file_extension: Mapped[str] = mapped_column(
        String(16),
        default=".txt",
        nullable=False,
        doc="File format extension",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="File size in bytes",
    )
    char_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Total character count in document text",
    )
    chunk_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Number of chunks generated from this document",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="completed",
        nullable=False,
        doc="Processing status: queuing, indexing, completed, error",
    )
    chunk_size: Mapped[int] = mapped_column(
        Integer,
        default=500,
        nullable=False,
        doc="Maximum length per chunk in characters",
    )
    chunk_overlap: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
        doc="Overlap length between adjacent chunks in characters",
    )
    error_msg: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Error trace if indexing failed",
    )

    # Relationships
    knowledge_base: Mapped["KnowledgeBaseORM"] = relationship(
        "KnowledgeBaseORM",
        back_populates="documents",
    )
    chunks: Mapped[List["DocumentChunkORM"]] = relationship(
        "DocumentChunkORM",
        back_populates="document",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<DocumentORM id={self.id} name={self.name} chunks={self.chunk_count}>"


class DocumentChunkORM(Base, TimestampMixin):
    """
    Text Segment / Chunk with vector embeddings for semantic similarity search.
    """
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=generate_uuid,
        doc="Unique chunk identifier",
    )
    kb_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Parent knowledge base identifier for fast cross-doc search",
    )
    doc_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Source document reference",
    )
    position: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Sequential paragraph index within source document (0, 1, 2...)",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Raw text chunk content",
    )
    token_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Token count estimate for this chunk",
    )
    embedding: Mapped[list] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
        doc="Dense vector embedding array (PostgreSQL: pgvector / SQLite: JSON float array)",
    )
    hit_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Recall frequency counter for telemetry and knowledge optimization",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Toggle to exclude specific noisy/dirty chunks from retrieval",
    )

    # Relationships
    knowledge_base: Mapped["KnowledgeBaseORM"] = relationship(
        "KnowledgeBaseORM",
        back_populates="chunks",
    )
    document: Mapped["DocumentORM"] = relationship(
        "DocumentORM",
        back_populates="chunks",
    )

    def __repr__(self) -> str:
        return f"<DocumentChunkORM id={self.id} doc={self.doc_id} pos={self.position}>"
