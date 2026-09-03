"""
RAG Text Preprocessing and Cleaning Module (Aligned with Dify ETL Standard)
"""

import re


def clean_document_text(
    text: str,
    remove_extra_spaces: bool = True,
    normalize_newlines: bool = True,
) -> str:
    """
    Clean and normalize raw document text before splitting into chunks.

    Transformations:
    1. Unify all carriage returns (\\r\\n, \\r) to \\n.
    2. Convert tabs, non-breaking spaces (\\u00a0) and special spaces to standard spaces.
    3. Compress 3 or more consecutive newlines into 2 newlines (\\n\\n).
    4. Compress consecutive horizontal spaces into a single space (while keeping line breaks).
    5. Strip surrounding leading/trailing whitespace.
    """
    if not text:
        return ""

    # 1. Normalize line endings
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")

    # 2. Normalize tabs and Unicode special whitespace
    cleaned = re.sub(r"[\t\u00a0\u2000-\u200b\u3000]", " ", cleaned)

    # 3. Compress consecutive newlines (3+ newlines -> 2 newlines)
    if normalize_newlines:
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # 4. Compress consecutive spaces on the same line (excluding newlines)
    if remove_extra_spaces:
        cleaned = re.sub(r"[^\S\n]{2,}", " ", cleaned)
        # Remove trailing spaces before newlines
        cleaned = re.sub(r"[^\S\n]+\n", "\n", cleaned)

    return cleaned.strip()
