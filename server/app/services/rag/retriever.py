"""
Vector Similarity Retrieval Service (Cosine Similarity Search & Context Assembly)
Supports both Zero-Docker SQLite (in-memory vectorized dot product) and PostgreSQL.
"""

import logging
import math
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import DocumentChunkORM, DocumentORM, KnowledgeBaseORM
from app.schemas.knowledge import RetrievalResponse, RetrievedChunk
from .embedder import embedding_client

logger = logging.getLogger("patchcat.rag.retriever")


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    sim = dot_product / (norm_a * norm_b)
    return max(-1.0, min(1.0, sim))


class VectorRetriever:
    """
    RAG Semantic Retrieval Engine.
    Vectorizes queries and searches against knowledge base chunks.
    """

    async def retrieve(
        self,
        db: AsyncSession,
        kb_id: str,
        query: str,
        top_k: int = 3,
        score_threshold: float = 0.0,
    ) -> RetrievalResponse:
        """
        Execute semantic similarity retrieval against a specific knowledge base.
        """
        # 1. Fetch Knowledge Base configuration
        kb_stmt = select(KnowledgeBaseORM).where(KnowledgeBaseORM.id == kb_id)
        kb_res = await db.execute(kb_stmt)
        kb = kb_res.scalar_one_or_none()
        if not kb:
            raise ValueError(f"Knowledge Base '{kb_id}' not found")

        # 2. Vectorize the incoming user query
        query_vector = await embedding_client.embed_query(
            text=query,
            provider=kb.embedding_provider,
            model=kb.embedding_model,
            dimension=kb.embedding_dimension,
        )

        # 3. Fetch active chunks belonging to this KB with document name
        stmt = (
            select(DocumentChunkORM, DocumentORM.name.label("doc_name"))
            .join(DocumentORM, DocumentChunkORM.doc_id == DocumentORM.id)
            .where(
                DocumentChunkORM.kb_id == kb_id,
                DocumentChunkORM.is_active == True,
            )
        )
        result = await db.execute(stmt)
        rows = result.all()

        # 4. Calculate similarity scores
        scored_items: List[Tuple[float, DocumentChunkORM, str]] = []
        for chunk_orm, doc_name in rows:
            chunk_vec = chunk_orm.embedding
            if not chunk_vec:
                continue

            score = cosine_similarity(query_vector, chunk_vec)
            if score >= score_threshold:
                scored_items.append((score, chunk_orm, doc_name))

        # 5. Sort descending by score
        scored_items.sort(key=lambda x: x[0], reverse=True)
        top_items = scored_items[:top_k]

        # 6. Increment hit count for recalled chunks
        retrieved_chunks: List[RetrievedChunk] = []
        context_parts: List[str] = []

        for score, chunk, doc_name in top_items:
            chunk.hit_count += 1
            rounded_score = round(score, 4)

            retrieved_chunks.append(
                RetrievedChunk(
                    id=chunk.id,
                    doc_id=chunk.doc_id,
                    doc_name=doc_name,
                    position=chunk.position,
                    content=chunk.content,
                    score=rounded_score,
                    token_count=chunk.token_count,
                )
            )

            # Build markdown context block with citation header
            context_parts.append(
                f"### [Document: {doc_name} (Similarity: {rounded_score:.2f})]\n{chunk.content}"
            )

        # Commit hit_count increments
        if top_items:
            await db.commit()

        concatenated_context = "\n\n---\n\n".join(context_parts)

        logger.info(
            "Retrieved %d chunks for query '%s' in KB '%s' (top_k=%d, threshold=%.2f)",
            len(retrieved_chunks),
            query[:50],
            kb_id,
            top_k,
            score_threshold,
        )

        return RetrievalResponse(
            query=query,
            knowledge_base_id=kb_id,
            top_k=top_k,
            score_threshold=score_threshold,
            total_recalled=len(retrieved_chunks),
            context=concatenated_context,
            chunks=retrieved_chunks,
        )


# Global instance
vector_retriever = VectorRetriever()
