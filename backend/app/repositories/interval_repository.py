from datetime import date, datetime, timedelta
from typing import Any

from redis.asyncio import Redis


def interval_key(interval_id: str) -> str:
    return f"interval:{interval_id}"


def week_intervals_key(week_start: str) -> str:
    return f"week:{week_start}:intervals"


def task_intervals_key(task_id: str) -> str:
    return f"task:{task_id}:intervals"


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


class IntervalRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def create(
        self,
        interval_id: str,
        task_id: str,
        start: datetime,
        end: datetime,
        task_name: str = "",
    ) -> str:
        week_start = monday_of(start.date()).isoformat()
        await self._redis.hset(
            interval_key(interval_id),
            mapping={
                "task_id": task_id,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "week_start": week_start,
                "task_name": task_name,
            },
        )
        await self._redis.zadd(week_intervals_key(week_start), {interval_id: start.timestamp()})
        await self._redis.sadd(task_intervals_key(task_id), interval_id)
        return week_start

    async def get(self, interval_id: str) -> dict[str, Any] | None:
        data = await self._redis.hgetall(interval_key(interval_id))
        return data or None

    async def update(self, interval_id: str, start: datetime, end: datetime) -> str | None:
        data = await self.get(interval_id)
        if data is None:
            return None

        old_week_start = data["week_start"]
        new_week_start = monday_of(start.date()).isoformat()
        await self._redis.hset(
            interval_key(interval_id),
            mapping={
                "start": start.isoformat(),
                "end": end.isoformat(),
                "week_start": new_week_start,
            },
        )
        if new_week_start != old_week_start:
            await self._redis.zrem(week_intervals_key(old_week_start), interval_id)
        await self._redis.zadd(week_intervals_key(new_week_start), {interval_id: start.timestamp()})
        return new_week_start

    async def delete(self, interval_id: str) -> dict[str, Any] | None:
        data = await self.get(interval_id)
        if data is None:
            return None
        await self._redis.delete(interval_key(interval_id))
        await self._redis.zrem(week_intervals_key(data["week_start"]), interval_id)
        await self._redis.srem(task_intervals_key(data["task_id"]), interval_id)
        return data

    async def list_for_week(self, week_start: str) -> list[dict[str, Any]]:
        ids = await self._redis.zrange(week_intervals_key(week_start), 0, -1)
        results = []
        for interval_id in ids:
            data = await self.get(interval_id)
            if data:
                results.append({"id": interval_id, **data})
        return results

    async def list_for_task(self, task_id: str) -> list[dict[str, Any]]:
        ids = await self._redis.smembers(task_intervals_key(task_id))
        results = []
        for interval_id in ids:
            data = await self.get(interval_id)
            if data:
                results.append({"id": interval_id, **data})
        return results

    async def count_for_task(self, task_id: str) -> int:
        return await self._redis.scard(task_intervals_key(task_id))

    async def set_google_event_id(self, interval_id: str, google_event_id: str) -> None:
        await self._redis.hset(interval_key(interval_id), "google_event_id", google_event_id)
