from scripts.migrate_routine_to_recurrent_task import (
    FIELD_RENAMES,
    NEW_SET_KEY,
    OLD_SET_KEY,
    migrate,
)


async def seed_old_shaped_task(redis_client, task_id: str, **extra_fields) -> None:
    fields = {
        "name": "Old-shaped recurrent task",
        "is_routine": "1",
        "routine_anchor_date": "2026-08-01",
        "routine_start_time": "09:00:00",
        "routine_duration_minutes": "60",
        "routine_generated_until": "2026-08-28",
        **extra_fields,
    }
    await redis_client.hset(f"task:{task_id}", mapping=fields)
    await redis_client.sadd(OLD_SET_KEY, task_id)


async def test_migrates_fields_and_renames_the_set(redis_client):
    await seed_old_shaped_task(redis_client, "t1")

    log = await migrate(redis_client)
    assert len(log) == len(FIELD_RENAMES) + 1  # 5 field renames + the set rename

    fields = await redis_client.hgetall("task:t1")
    for old_field, new_field in FIELD_RENAMES.items():
        assert old_field not in fields
        assert new_field in fields
    assert fields["is_recurrent_task"] == "1"
    assert fields["recurrent_task_anchor_date"] == "2026-08-01"

    assert not await redis_client.exists(OLD_SET_KEY)
    assert await redis_client.smembers(NEW_SET_KEY) == {"t1"}


async def test_is_idempotent(redis_client):
    await seed_old_shaped_task(redis_client, "t1")

    first_log = await migrate(redis_client)
    assert first_log  # something happened

    second_log = await migrate(redis_client)
    assert second_log == []  # nothing left to do

    fields = await redis_client.hgetall("task:t1")
    assert fields["is_recurrent_task"] == "1"


async def test_dry_run_makes_no_changes(redis_client):
    await seed_old_shaped_task(redis_client, "t1")

    log = await migrate(redis_client, dry_run=True)
    assert log  # reports what it would do

    # Nothing actually changed.
    fields = await redis_client.hgetall("task:t1")
    assert "is_routine" in fields
    assert "is_recurrent_task" not in fields
    assert await redis_client.exists(OLD_SET_KEY)
    assert not await redis_client.exists(NEW_SET_KEY)


async def test_resumes_a_partially_migrated_task(redis_client):
    # Simulates an interrupted prior run: some fields already renamed, the
    # set itself not yet renamed.
    await seed_old_shaped_task(redis_client, "t1")
    await redis_client.hset("task:t1", "is_recurrent_task", "1")
    await redis_client.hdel("task:t1", "is_routine")

    log = await migrate(redis_client)

    fields = await redis_client.hgetall("task:t1")
    for old_field, new_field in FIELD_RENAMES.items():
        assert old_field not in fields
        assert new_field in fields
    # Only 4 remaining field renames + the set rename -- is_routine/
    # is_recurrent_task was already done, so not re-logged.
    assert len(log) == len(FIELD_RENAMES) - 1 + 1
    assert await redis_client.smembers(NEW_SET_KEY) == {"t1"}


async def test_merges_when_both_old_and_new_set_exist(redis_client):
    # Simulates an interrupted prior run: the set rename step ran (creating
    # the new set) but somehow the old set still exists too (e.g. a
    # concurrent write re-added to it) -- both members must end up unioned
    # into the new set, with the old one cleaned up, not silently dropped.
    await seed_old_shaped_task(redis_client, "t1")
    await redis_client.sadd(NEW_SET_KEY, "t2")

    await migrate(redis_client)

    assert not await redis_client.exists(OLD_SET_KEY)
    assert await redis_client.smembers(NEW_SET_KEY) == {"t1", "t2"}


async def test_no_recurrent_tasks_is_a_no_op(redis_client):
    log = await migrate(redis_client)
    assert log == []
