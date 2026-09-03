"""
Unified Embedding Service for Multi-Provider Vectorization (OpenAI, SiliconFlow, Ollama)
Includes high-fidelity deterministic offline vector generator for zero-setup local dev.
"""

import hashlib
import logging
import math
from typing import List, Optional
import httpx

logger = logging.getLogger("patchcat.rag.embedder")


def generate_deterministic_embedding(text: str, dimension: int = 1536) -> List[float]:
    """
    Generate a normalized deterministic vector based on text token hashing.
    Provides stable, non-zero cosine similarity for semantic overlap tests
    without requiring external network calls or API keys.
    """
    if not text.strip():
        # Zero vector normalized
        vec = [0.0] * dimension
        vec[0] = 1.0
        return vec

    vec = [0.0] * dimension
    words = text.lower().split()
    chars = list(text)

    # 1. Project character bigrams into vector coordinates
    for i in range(len(chars) - 1):
        bigram = chars[i] + chars[i + 1]
        h = int(hashlib.md5(bigram.encode("utf-8")).hexdigest(), 16)
        idx = h % dimension
        vec[idx] += 1.0

    # 2. Project word tokens into vector coordinates
    for word in words:
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dimension
        vec[idx] += 2.0

    # 3. L2 Normalize to unit vector (||v|| = 1.0)
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 6) for x in vec]
    else:
        vec[0] = 1.0

    return vec


class EmbeddingClient:
    """
    Unified Embedding Client supporting OpenAI-compatible endpoints and local models.
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    def _resolve_endpoint(self, provider: str, base_url: Optional[str]) -> str:
        if base_url and base_url.strip():
            clean = base_url.strip().rstrip("/")
            return clean if clean.endswith("/embeddings") else f"{clean}/embeddings"

        if provider == "siliconflow":
            return "https://api.siliconflow.cn/v1/embeddings"
        if provider == "ollama":
            return "http://localhost:11434/api/embeddings"
        # Default OpenAI
        return "https://api.openai.com/v1/embeddings"

    async def embed_query(
        self,
        text: str,
        provider: str = "openai",
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
        api_key: str = "",
        base_url: str = "",
    ) -> List[float]:
        """Generate embedding vector for a single query string."""
        results = await self.embed_documents(
            texts=[text],
            provider=provider,
            model=model,
            dimension=dimension,
            api_key=api_key,
            base_url=base_url,
        )
        return results[0] if results else generate_deterministic_embedding(text, dimension)

    async def embed_documents(
        self,
        texts: List[str],
        provider: str = "openai",
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
        api_key: str = "",
        base_url: str = "",
    ) -> List[List[float]]:
        """
        Batch generate embeddings for a list of texts.
        Falls back to deterministic offline vectors if no API key is provided or on network error.
        """
        if not texts:
            return []

        # If no key provided for external provider (excluding local ollama), use offline generator
        clean_key = api_key.strip()
        if not clean_key and provider != "ollama":
            logger.debug(
                "No API Key configured for provider='%s'; using deterministic offline embedding",
                provider,
            )
            return [generate_deterministic_embedding(t, dimension) for t in texts]

        endpoint = self._resolve_endpoint(provider, base_url)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {clean_key}",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "model": model,
                    "input": texts,
                }
                # OpenAI text-embedding-3 supports dimensions parameter
                if "text-embedding-3" in model and dimension:
                    payload["dimensions"] = dimension

                res = await client.post(endpoint, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    if "data" in data and isinstance(data["data"], list):
                        # Sort by index if returned
                        sorted_items = sorted(data["data"], key=lambda x: x.get("index", 0))
                        return [item["embedding"] for item in sorted_items]

                logger.warning(
                    "Embedding API returned status=%d, falling back to offline vectors: %s",
                    res.status_code,
                    res.text[:200],
                )
        except Exception as e:
            logger.warning(
                "Failed to connect to embedding endpoint '%s': %s. Falling back to offline vectors.",
                endpoint,
                e,
            )

        return [generate_deterministic_embedding(t, dimension) for t in texts]


# Global instance
embedding_client = EmbeddingClient()
