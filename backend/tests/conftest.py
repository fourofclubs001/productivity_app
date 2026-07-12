import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from fastapi.testclient import TestClient

from app.main import app
from app.redis_client import get_redis


@pytest_asyncio.fixture
async def redis_client():
    client = FakeRedis(decode_responses=True)
    yield client
    await client.flushall()
    await client.aclose()


@pytest.fixture
def client(redis_client):
    async def override_get_redis():
        yield redis_client

    app.dependency_overrides[get_redis] = override_get_redis
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
