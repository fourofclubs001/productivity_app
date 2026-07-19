from datetime import datetime
from typing import Any

from redis.asyncio import Redis

ACTIVE_ENTRY_KEY = "active_entry"
ENTRIES_BY_START_KEY = "entries:by_start"


def entry_key(entry_id: str) -> str:
    return f"entry:{entry_id}"


def task_entries_key(task_id: str) -> str:
    return f"task:{task_id}:entries"


class EntryRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def create(
        self, entry_id: str, task_id: str, start: datetime, task_name: str = ""
    ) -> None:
        await self._redis.hset(
            entry_key(entry_id),
            mapping={"task_id": task_id, "start": start.isoformat(), "task_name": task_name},
        )
        await self._redis.zadd(ENTRIES_BY_START_KEY, {entry_id: start.timestamp()})
        await self._redis.sadd(task_entries_key(task_id), entry_id)

    async def set_end(self, entry_id: str, end: datetime) -> dict[str, Any] | None:
        data = await self.get(entry_id)
        if data is None:
            return None
        await self._redis.hset(entry_key(entry_id), "end", end.isoformat())
        data["end"] = end.isoformat()
        return data

    async def get(self, entry_id: str) -> dict[str, Any] | None:
        data = await self._redis.hgetall(entry_key(entry_id))
        return data or None

    async def get_active_id(self) -> str | None:
        return await self._redis.get(ACTIVE_ENTRY_KEY)

    async def set_active_id(self, entry_id: str | None) -> None:
        if entry_id is None:
            await self._redis.delete(ACTIVE_ENTRY_KEY)
        else:
            await self._redis.set(ACTIVE_ENTRY_KEY, entry_id)

    async def list_for_range(self, start_ts: float, end_ts: float) -> list[dict[str, Any]]:
        ids = await self._redis.zrangebyscore(ENTRIES_BY_START_KEY, start_ts, end_ts)
        results = []
        for entry_id in ids:
            data = await self.get(entry_id)
            if data:
                results.append({"id": entry_id, **data})
        return results
