from dataclasses import dataclass, field
from typing import Any

from redis.asyncio import Redis

ALL_TASKS_KEY = "tasks:all"
ROOTS_KEY = "tasks:roots"


def task_key(task_id: str) -> str:
    return f"task:{task_id}"


def children_key(task_id: str) -> str:
    return f"task:{task_id}:children"


def parents_key(task_id: str) -> str:
    return f"task:{task_id}:parents"


def colors_key(task_id: str) -> str:
    return f"task:{task_id}:colors"


@dataclass
class TaskNode:
    id: str
    fields: dict[str, Any]
    children: set[str] = field(default_factory=set)
    parents: set[str] = field(default_factory=set)
    colors: set[str] = field(default_factory=set)


class TaskRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def exists(self, task_id: str) -> bool:
        return bool(await self._redis.sismember(ALL_TASKS_KEY, task_id))

    async def create(self, task_id: str, fields: dict[str, Any]) -> None:
        await self._redis.hset(task_key(task_id), mapping=fields)
        await self._redis.sadd(ALL_TASKS_KEY, task_id)
        await self._redis.sadd(ROOTS_KEY, task_id)

    async def update_fields(self, task_id: str, fields: dict[str, Any]) -> None:
        if fields:
            await self._redis.hset(task_key(task_id), mapping=fields)

    async def set_colors(self, task_id: str, colors: list[str]) -> None:
        key = colors_key(task_id)
        await self._redis.delete(key)
        if colors:
            await self._redis.sadd(key, *colors)

    async def add_child_edge(self, parent_id: str, child_id: str) -> None:
        await self._redis.sadd(children_key(parent_id), child_id)
        await self._redis.sadd(parents_key(child_id), parent_id)
        await self._redis.srem(ROOTS_KEY, child_id)

    async def remove_child_edge(self, parent_id: str, child_id: str) -> None:
        await self._redis.srem(children_key(parent_id), child_id)
        await self._redis.srem(parents_key(child_id), parent_id)
        if not await self._redis.smembers(parents_key(child_id)):
            await self._redis.sadd(ROOTS_KEY, child_id)

    async def delete(self, task_id: str) -> None:
        children = await self._redis.smembers(children_key(task_id))
        parents = await self._redis.smembers(parents_key(task_id))

        for child_id in children:
            await self._redis.srem(parents_key(child_id), task_id)
            if not await self._redis.smembers(parents_key(child_id)):
                await self._redis.sadd(ROOTS_KEY, child_id)
        for parent_id in parents:
            await self._redis.srem(children_key(parent_id), task_id)

        await self._redis.delete(
            task_key(task_id), children_key(task_id), parents_key(task_id), colors_key(task_id)
        )
        await self._redis.srem(ALL_TASKS_KEY, task_id)
        await self._redis.srem(ROOTS_KEY, task_id)

    async def load_graph(self) -> dict[str, TaskNode]:
        task_ids = await self._redis.smembers(ALL_TASKS_KEY)
        graph: dict[str, TaskNode] = {}
        for task_id in task_ids:
            task_fields = await self._redis.hgetall(task_key(task_id))
            children = await self._redis.smembers(children_key(task_id))
            parents = await self._redis.smembers(parents_key(task_id))
            colors = await self._redis.smembers(colors_key(task_id))
            graph[task_id] = TaskNode(
                id=task_id, fields=task_fields, children=children, parents=parents, colors=colors
            )
        return graph

    async def load_node(self, task_id: str) -> TaskNode | None:
        task_fields = await self._redis.hgetall(task_key(task_id))
        if not task_fields:
            return None
        children = await self._redis.smembers(children_key(task_id))
        parents = await self._redis.smembers(parents_key(task_id))
        colors = await self._redis.smembers(colors_key(task_id))
        return TaskNode(
            id=task_id, fields=task_fields, children=children, parents=parents, colors=colors
        )
