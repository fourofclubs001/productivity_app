from typing import Any

from redis.asyncio import Redis

EXCUSES_ALL_KEY = "excuses:all"
EXCUSES_BY_TEXT_KEY = "excuses:by_text"
ATTACHMENTS_BY_START_KEY = "excuse_attachments:by_start"
ATTACHMENTS_BY_GAP_KEY = "excuse_attachments:by_gap"


def excuse_key(excuse_id: str) -> str:
    return f"excuse:{excuse_id}"


def attachment_key(attachment_id: str) -> str:
    return f"excuse_attachment:{attachment_id}"


def normalize_text(text: str) -> str:
    return text.strip().lower()


def gap_key(task_id: str, start_iso: str, end_iso: str) -> str:
    return f"{task_id}|{start_iso}|{end_iso}"


class ExcuseRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def create_excuse(self, excuse_id: str, text: str, created_at: str) -> None:
        await self._redis.hset(
            excuse_key(excuse_id), mapping={"id": excuse_id, "text": text, "created_at": created_at}
        )
        await self._redis.sadd(EXCUSES_ALL_KEY, excuse_id)
        await self._redis.hset(EXCUSES_BY_TEXT_KEY, normalize_text(text), excuse_id)

    async def get_excuse(self, excuse_id: str) -> dict[str, Any] | None:
        data = await self._redis.hgetall(excuse_key(excuse_id))
        return data or None

    async def find_excuse_by_text(self, text: str) -> str | None:
        return await self._redis.hget(EXCUSES_BY_TEXT_KEY, normalize_text(text))

    async def list_excuses(self) -> list[dict[str, Any]]:
        excuse_ids = await self._redis.smembers(EXCUSES_ALL_KEY)
        results = []
        for excuse_id in excuse_ids:
            data = await self.get_excuse(excuse_id)
            if data:
                results.append(data)
        return results

    async def find_attachment_by_gap(
        self, task_id: str, start_iso: str, end_iso: str
    ) -> str | None:
        return await self._redis.hget(ATTACHMENTS_BY_GAP_KEY, gap_key(task_id, start_iso, end_iso))

    async def create_attachment(
        self,
        attachment_id: str,
        excuse_id: str,
        task_id: str,
        interval_id: str | None,
        start_iso: str,
        end_iso: str,
        start_ts: float,
        created_at: str,
    ) -> None:
        await self._redis.hset(
            attachment_key(attachment_id),
            mapping={
                "id": attachment_id,
                "excuse_id": excuse_id,
                "task_id": task_id,
                "interval_id": interval_id or "",
                "start": start_iso,
                "end": end_iso,
                "created_at": created_at,
            },
        )
        await self._redis.zadd(ATTACHMENTS_BY_START_KEY, {attachment_id: start_ts})
        await self._redis.hset(
            ATTACHMENTS_BY_GAP_KEY, gap_key(task_id, start_iso, end_iso), attachment_id
        )

    async def update_attachment_excuse(self, attachment_id: str, excuse_id: str) -> None:
        await self._redis.hset(attachment_key(attachment_id), "excuse_id", excuse_id)

    async def get_attachment(self, attachment_id: str) -> dict[str, Any] | None:
        data = await self._redis.hgetall(attachment_key(attachment_id))
        return data or None

    async def list_attachments_for_range(
        self, start_ts: float, end_ts: float
    ) -> list[dict[str, Any]]:
        ids = await self._redis.zrangebyscore(ATTACHMENTS_BY_START_KEY, start_ts, end_ts)
        results = []
        for attachment_id in ids:
            data = await self.get_attachment(attachment_id)
            if data:
                results.append(data)
        return results
