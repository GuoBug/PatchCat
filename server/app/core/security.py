"""
API access control & rate limiting.

- Bearer / X-API-Token authentication is opt-in via ``API_AUTH_TOKEN``. When unset the API is
  open, which is only acceptable while bound to loopback (enforced at startup, see main.py).
- Rate limiting is a small in-process sliding window keyed by client IP. It is NOT shared
  across worker processes; put a reverse proxy / gateway in front for multi-worker deployments.
"""

import secrets
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional

from fastapi import Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def is_loopback_host(host: str) -> bool:
    return host.strip().lower() in LOOPBACK_HOSTS


def verify_startup_security() -> None:
    """Refuse to expose an unauthenticated API beyond loopback unless explicitly allowed."""
    exposed = not is_loopback_host(settings.HOST)
    if exposed and not settings.API_AUTH_TOKEN:
        msg = (
            f"HOST={settings.HOST} exposes the API beyond loopback but API_AUTH_TOKEN is not set. "
            "Set API_AUTH_TOKEN or bind HOST=127.0.0.1 (or set ALLOW_INSECURE_NO_AUTH=true to bypass)."
        )
        if not settings.ALLOW_INSECURE_NO_AUTH:
            raise RuntimeError(msg)
        import logging

        logging.getLogger("patchcat.security").warning(
            "SECURITY WARNING: %s (Running insecure due to ALLOW_INSECURE_NO_AUTH=true)", msg
        )


def safe_equals(a: Optional[str], b: Optional[str]) -> bool:
    """Constant-time string comparison that tolerates missing values."""
    if not a or not b:
        return False
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


async def require_api_token(
    authorization: Optional[str] = Header(None),
    x_api_token: Optional[str] = Header(None, alias="X-API-Token"),
) -> None:
    """FastAPI dependency: enforce API_AUTH_TOKEN when configured."""
    expected = settings.API_AUTH_TOKEN
    if not expected:
        return
    provided = x_api_token
    if not provided and authorization and authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()
    if not safe_equals(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding-window limiter. Disabled when RATE_LIMIT_PER_MINUTE <= 0."""

    def __init__(self, app, limit_per_minute: int, window_seconds: int = 60):
        super().__init__(app)
        self.limit = limit_per_minute
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if self.limit <= 0 or request.method == "OPTIONS":
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[client]
        while hits and now - hits[0] > self.window:
            hits.popleft()

        if len(hits) >= self.limit:
            retry_after = max(1, int(self.window - (now - hits[0])))
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please retry later."},
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)
        # Opportunistic cleanup so idle clients do not accumulate forever.
        if len(self._hits) > 10000:
            for key in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                self._hits.pop(key, None)
        return await call_next(request)
