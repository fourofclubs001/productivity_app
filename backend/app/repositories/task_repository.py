from dataclasses import dataclass, field
from typing import Any

from redis.asyncio import Redis

ALL_TASKS_KEY = "tasks:all"
ROOTS_KEY = "tasks:roots"
RECURRENT_TASKS_KEY = "recurrent_tasks:all"
ORDER_SEQ_KEY = "tasks:order_seq"
ORDER_STEP = 1000


def task_key(task_id: str) -> str:
    return f"task:{task_id}"


def children_key(task_id: str) -> str:
    return f"task:{task_id}:children"


def parents_key(task_id: str) -> str:
    return f"task:{task_id}:parents"


def colors_key(task_id: str) -> str:
    return f"task:{task_id}:colors"


def requires_key(task_id: str) -> str:
    return f"task:{task_id}:requires"


def required_by_key(task_id: str) -> str:
    return f"task:{task_id}:required_by"


@dataclass
class TaskNode:
    id: str
    fields: dict[str, Any]
    children: set[str] = field(default_factory=set)
    parents: set[str] = field(default_factory=set)
    colors: set[str] = field(default_factory=set)
    requires: set[str] = field(default_factory=set)
    required_by: set[str] = field(default_factory=set)


class TaskRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def exists(self, task_id: str) -> bool:
        return bool(await self._redis.sismember(ALL_TASKS_KEY, task_id))

    async def create(self, task_id: str, fields: dict[str, Any]) -> None:
        await self._redis.hset(task_key(task_id), mapping=fields)
        await self._redis.sadd(ALL_TASKS_KEY, task_id)
        await self._redis.sadd(ROOTS_KEY, task_id)

    async def next_order(self) -> float:
        """Monotonically increasing order value for a newly created task.

        Existing tasks predating this field default to order 0 when read (see
        TaskNode/_to_task_out), so starting this sequence above zero keeps new
        tasks sorting after all legacy ones without a backfill migration.
        """
        return float(await self._redis.incrby(ORDER_SEQ_KEY, ORDER_STEP))

    async def update_fields(self, task_id: str, fields: dict[str, Any]) -> None:
        if fields:
            await self._redis.hset(task_key(task_id), mapping=fields)

    async def add_to_recurrent_tasks(self, task_id: str) -> None:
        await self._redis.sadd(RECURRENT_TASKS_KEY, task_id)

    async def list_recurrent_task_ids(self) -> set[str]:
        return await self._redis.smembers(RECURRENT_TASKS_KEY)

    async def set_colors(self, task_id: str, colors: list[str]) -> None:
        key = colors_key(task_id)
        await self._redis.delete(key)
        if colors:
            await self._redis.sadd(key, *colors)

    async def add_child_edge(self, parent_id: str, child_id: str) -> None:
        await self._redis.sadd(children_key(parent_id), child_id)
        await self._redis.sadd(parents_key(child_id), parent_id)
        await self._redis.srem(ROOTS_KEY, child_id)
        # Monotonic marker: once a task has ever had a child, it's permanently
        # treated as a goal (not a leaf) even if later emptied out entirely --
        # see _compute_state/keep_as_backlog (v03 item 10).
        await self._redis.hset(task_key(parent_id), "ever_had_children", "1")

    async def remove_child_edge(self, parent_id: str, child_id: str) -> None:
        await self._redis.srem(children_key(parent_id), child_id)
        await self._redis.srem(parents_key(child_id), parent_id)
        if not await self._redis.smembers(parents_key(child_id)):
            await self._redis.sadd(ROOTS_KEY, child_id)

    async def add_requirement_edge(self, task_id: str, required_id: str) -> None:
        await self._redis.sadd(requires_key(task_id), required_id)
        await self._redis.sadd(required_by_key(required_id), task_id)

    async def remove_requirement_edge(self, task_id: str, required_id: str) -> None:
        await self._redis.srem(requires_key(task_id), required_id)
        await self._redis.srem(required_by_key(required_id), task_id)

    async def load_requirement_graph(self) -> dict[str, set[str]]:
        """task_id -> set of task_ids it requires, for every task."""
        task_ids = await self._redis.smembers(ALL_TASKS_KEY)
        graph: dict[str, set[str]] = {}
        for task_id in task_ids:
            graph[task_id] = await self._redis.smembers(requires_key(task_id))
        return graph

    async def delete(self, task_id: str) -> None:
        children = await self._redis.smembers(children_key(task_id))
        parents = await self._redis.smembers(parents_key(task_id))
        requires = await self._redis.smembers(requires_key(task_id))
        required_by = await self._redis.smembers(required_by_key(task_id))

        for child_id in children:
            await self._redis.srem(parents_key(child_id), task_id)
            if not await self._redis.smembers(parents_key(child_id)):
                await self._redis.sadd(ROOTS_KEY, child_id)
        for parent_id in parents:
            await self._redis.srem(children_key(parent_id), task_id)
        for required_id in requires:
            await self._redis.srem(required_by_key(required_id), task_id)
        for dependent_id in required_by:
            await self._redis.srem(requires_key(dependent_id), task_id)

        await self._redis.delete(
            task_key(task_id),
            children_key(task_id),
            parents_key(task_id),
            colors_key(task_id),
            requires_key(task_id),
            required_by_key(task_id),
        )
        await self._redis.srem(ALL_TASKS_KEY, task_id)
        await self._redis.srem(ROOTS_KEY, task_id)
        await self._redis.srem(RECURRENT_TASKS_KEY, task_id)

    async def load_graph(self) -> dict[str, TaskNode]:
        task_ids = await self._redis.smembers(ALL_TASKS_KEY)
        graph: dict[str, TaskNode] = {}
        for task_id in task_ids:
            task_fields = await self._redis.hgetall(task_key(task_id))
            children = await self._redis.smembers(children_key(task_id))
            parents = await self._redis.smembers(parents_key(task_id))
            colors = await self._redis.smembers(colors_key(task_id))
            requires = await self._redis.smembers(requires_key(task_id))
            required_by = await self._redis.smembers(required_by_key(task_id))
            graph[task_id] = TaskNode(
                id=task_id,
                fields=task_fields,
                children=children,
                parents=parents,
                colors=colors,
                requires=requires,
                required_by=required_by,
            )
        return graph

    async def load_node(self, task_id: str) -> TaskNode | None:
        task_fields = await self._redis.hgetall(task_key(task_id))
        if not task_fields:
            return None
        children = await self._redis.smembers(children_key(task_id))
        parents = await self._redis.smembers(parents_key(task_id))
        colors = await self._redis.smembers(colors_key(task_id))
        requires = await self._redis.smembers(requires_key(task_id))
        required_by = await self._redis.smembers(required_by_key(task_id))
        return TaskNode(
            id=task_id,
            fields=task_fields,
            children=children,
            parents=parents,
            colors=colors,
            requires=requires,
            required_by=required_by,
        )
