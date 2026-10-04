"""
Tests for API token authentication, constant-time compare and rate limiting.
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.core.config import settings
from app.core.security import RateLimitMiddleware, safe_equals


def test_safe_equals_handles_missing_and_mismatch():
    assert safe_equals("abc", "abc")
    assert not safe_equals("abc", "abd")
    assert not safe_equals(None, "abc")
    assert not safe_equals("abc", "")


@pytest.mark.asyncio
async def test_api_open_when_token_unset(client, monkeypatch):
    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "")
    res = await client.get("/api/v1/folders")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_api_requires_token_when_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "s3cret-token")

    assert (await client.get("/api/v1/folders")).status_code == 401
    assert (
        await client.get("/api/v1/folders", headers={"Authorization": "Bearer wrong"})
    ).status_code == 401
    assert (
        await client.get("/api/v1/folders", headers={"Authorization": "Bearer s3cret-token"})
    ).status_code == 200
    assert (
        await client.get("/api/v1/folders", headers={"X-API-Token": "s3cret-token"})
    ).status_code == 200


@pytest.mark.asyncio
async def test_health_stays_open_with_token(client, monkeypatch):
    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "s3cret-token")
    res = await client.get("/api/v1/health")
    assert res.status_code != 401


def test_startup_guard_blocks_exposed_production(monkeypatch):
    monkeypatch.setattr(settings, "HOST", "0.0.0.0")
    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with pytest.raises(RuntimeError):
        security.verify_startup_security()

    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "tok")
    security.verify_startup_security()  # allowed once a token is configured

    monkeypatch.setattr(settings, "API_AUTH_TOKEN", "")
    monkeypatch.setattr(settings, "HOST", "127.0.0.1")
    security.verify_startup_security()  # loopback is fine without a token


@pytest.mark.asyncio
async def test_rate_limit_returns_429_after_limit():
    mini = FastAPI()
    mini.add_middleware(RateLimitMiddleware, limit_per_minute=3)

    @mini.get("/ping")
    async def ping():
        return {"ok": True}

    transport = ASGITransport(app=mini)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        codes = [(await ac.get("/ping")).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]


@pytest.mark.asyncio
async def test_rate_limit_disabled_when_zero():
    mini = FastAPI()
    mini.add_middleware(RateLimitMiddleware, limit_per_minute=0)

    @mini.get("/ping")
    async def ping():
        return {"ok": True}

    transport = ASGITransport(app=mini)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        codes = {(await ac.get("/ping")).status_code for _ in range(20)}
    assert codes == {200}
