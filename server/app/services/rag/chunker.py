"""
RAG Sliding Window Text Chunker with Overlap and Token Estimation
"""

import re
from dataclasses import dataclass
from typing import List


@dataclass
class ChunkItem:
    """Represents a generated text chunk with metadata."""
    position: int
    content: str
    char_count: int
    token_count: int


def estimate_tokens(text: str) -> int:
    """
    Fast estimation of token consumption for mixed Chinese and English text.
    - 1 Chinese / CJK character ≈ 1 token
    - 1 English word ≈ 1.3 tokens
    """
    if not text:
        return 0

    cjk_chars = len(re.findall(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", text))
    non_cjk = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", " ", text)
    english_words = len(non_cjk.split())

    estimated = int(cjk_chars * 1.0 + english_words * 1.3)
    return max(1, estimated) if text.strip() else 0


class TextChunker:
    """
    Text Chunker that respects paragraph boundaries and sliding window overlap.
    """

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        delimiter: str = "\n\n",
    ):
        self.chunk_size = max(50, chunk_size)
        self.chunk_overlap = max(0, min(chunk_overlap, self.chunk_size // 2))
        self.delimiter = delimiter

    def _split_into_atomic_segments(self, text: str) -> List[str]:
        """
        Split text into segments using delimiters.
        If a segment exceeds chunk_size, further break it down by lines or sentences.
        """
        raw_segments = text.split(self.delimiter) if self.delimiter else [text]
        atomic_segments: List[str] = []

        for seg in raw_segments:
            seg = seg.strip()
            if not seg:
                continue

            if len(seg) <= self.chunk_size:
                atomic_segments.append(seg)
            else:
                # Sub-split by secondary delimiter \n
                sub_lines = seg.split("\n")
                for line in sub_lines:
                    line = line.strip()
                    if not line:
                        continue
                    if len(line) <= self.chunk_size:
                        atomic_segments.append(line)
                    else:
                        # Sub-split by sentence delimiters (Chinese and English periods, question marks, exclamation points)
                        sentences = re.split(r"(?<=[。！？!?\.\n])", line)
                        for s in sentences:
                            s = s.strip()
                            if not s:
                                continue
                            if len(s) <= self.chunk_size:
                                atomic_segments.append(s)
                            else:
                                # Hard-split oversized sentence by character stride
                                step = self.chunk_size - self.chunk_overlap
                                for i in range(0, len(s), step):
                                    piece = s[i : i + self.chunk_size].strip()
                                    if piece:
                                        atomic_segments.append(piece)

        return atomic_segments

    def split_text(self, text: str) -> List[ChunkItem]:
        """
        Split text into overlapping chunks respecting max chunk size.
        """
        cleaned = text.strip()
        if not cleaned:
            return []

        segments = self._split_into_atomic_segments(cleaned)
        if not segments:
            return []

        chunks: List[ChunkItem] = []
        current_chunk_parts: List[str] = []
        current_length = 0

        for seg in segments:
            # Separator length when joining
            sep_len = len(self.delimiter) if current_chunk_parts else 0
            if current_length + sep_len + len(seg) <= self.chunk_size:
                current_chunk_parts.append(seg)
                current_length += sep_len + len(seg)
            else:
                # Flush current chunk
                if current_chunk_parts:
                    chunk_text = self.delimiter.join(current_chunk_parts).strip()
                    if chunk_text:
                        chunks.append(
                            ChunkItem(
                                position=len(chunks),
                                content=chunk_text,
                                char_count=len(chunk_text),
                                token_count=estimate_tokens(chunk_text),
                            )
                        )

                    # Compute overlap prefix from the tail of the flushed chunk
                    overlap_prefix = ""
                    if self.chunk_overlap > 0:
                        overlap_prefix = chunk_text[-self.chunk_overlap :].strip()

                    current_chunk_parts = [overlap_prefix, seg] if overlap_prefix else [seg]
                    current_length = sum(len(p) for p in current_chunk_parts) + (
                        len(self.delimiter) if overlap_prefix else 0
                    )
                else:
                    # Segment itself is somehow single, just start next
                    current_chunk_parts = [seg]
                    current_length = len(seg)

        # Flush remaining parts
        if current_chunk_parts:
            chunk_text = self.delimiter.join(current_chunk_parts).strip()
            if chunk_text:
                chunks.append(
                    ChunkItem(
                        position=len(chunks),
                        content=chunk_text,
                        char_count=len(chunk_text),
                        token_count=estimate_tokens(chunk_text),
                    )
                )

        return chunks
