"""One-time migration: rename "routine" Redis keys/fields to their
"recurrent task" equivalents (v05 item 5's code rename).

Idempotent -- safe to run more than once, including after a partial or
interrupted prior run: every write is guarded by checking whether the
destination already has the value, so nothing is double-applied or lost.

Usage (run inside the backend container so it reaches the same Redis the
app itself connects to):

    docker compose exec backend python -m scripts.migrate_routine_to_recurrent_task --dry-run
    docker compose exec backend python -m scripts.migrate_routine_to_recurrent_task

Always run with --dry-run first and inspect the output before running for
real, especially against prod's real data.
"""

import argparse
import asyncio

from redis.asyncio import Redis

from app.config import settings

OLD_SET_KEY = "routines:all"
NEW_SET_KEY = "recurrent_tasks:all"

FIELD_RENAMES = {
    "is_routine": "is_recurrent_task",
    "routine_anchor_date": "recurrent_task_anchor_date",
    "routine_start_time": "recurrent_task_start_time",
    "routine_duration_minutes": "recurrent_task_duration_minutes",
    "routine_generated_until": "recurrent_task_generated_until",
}


async def migrate(redis: Redis, dry_run: bool = False) -> list[str]:
    """Runs the migration, returning human-readable log lines describing
    what changed (or would change, in dry-run mode). Empty list means
    nothing was left to do.
    """
    log: list[str] = []

    old_exists = bool(await redis.exists(OLD_SET_KEY))
    new_exists = bool(await redis.exists(NEW_SET_KEY))
    if old_exists:
        task_ids = await redis.smembers(OLD_SET_KEY)
    elif new_exists:
        task_ids = await redis.smembers(NEW_SET_KEY)
    else:
        task_ids = set()

    for task_id in task_ids:
        task_key = f"task:{task_id}"
        for old_field, new_field in FIELD_RENAMES.items():
            if await redis.hexists(task_key, new_field):
                continue  # already migrated
            if not await redis.hexists(task_key, old_field):
                continue  # nothing to migrate for this field
            value = await redis.hget(task_key, old_field)
            log.append(f"{task_key}: {old_field} -> {new_field} = {value!r}")
            if not dry_run:
                await redis.hset(task_key, new_field, value)
                await redis.hdel(task_key, old_field)

    if old_exists and not new_exists:
        log.append(f"RENAME {OLD_SET_KEY} -> {NEW_SET_KEY}")
        if not dry_run:
            await redis.rename(OLD_SET_KEY, NEW_SET_KEY)
    elif old_exists and new_exists:
        # Both present -- a prior run got interrupted after creating the new
        # set but before removing the old one. Merge rather than silently
        # leaving stale/duplicate data behind.
        log.append(f"MERGE {OLD_SET_KEY} into {NEW_SET_KEY}, then delete {OLD_SET_KEY}")
        if not dry_run:
            if task_ids:
                await redis.sadd(NEW_SET_KEY, *task_ids)
            await redis.delete(OLD_SET_KEY)

    return log


async def _main(dry_run: bool) -> None:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        log = await migrate(redis, dry_run=dry_run)
        if not log:
            print("Nothing to do -- already migrated (or no recurrent tasks exist).")
            return
        for line in log:
            print(("[dry-run] " if dry_run else "") + line)
    finally:
        await redis.aclose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned changes without writing anything.",
    )
    args = parser.parse_args()
    asyncio.run(_main(args.dry_run))
