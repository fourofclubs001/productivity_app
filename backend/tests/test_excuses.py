from datetime import UTC, datetime, timedelta


def _next_monday(weeks_ahead: int) -> datetime:
    """A Monday comfortably in the future (never today), matching the
    convention used across this suite (see test_evaluate.py) so these fixed
    fixture times never collide with "today" regardless of when the suite
    happens to run.
    """
    now = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    return (now + timedelta(days=days_until_monday + weeks_ahead * 7)).replace(
        hour=0, minute=0, second=0
    )


_MONDAY = _next_monday(weeks_ahead=4)
WEEK_START = _MONDAY.date().isoformat()
NEXT_WEEK_START = (_MONDAY + timedelta(days=7)).date().isoformat()
START = _MONDAY + timedelta(hours=9)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def create_leaf(client, name="Leaf", parent_ids=None):
    response = client.post(
        "/tasks",
        json={"name": name, "definition_of_done": "d", "parent_ids": parent_ids or []},
    )
    assert response.status_code == 201
    return response.json()


def attach(
    client,
    task_id,
    start,
    end,
    interval_id=None,
    excuse_id=None,
    new_excuse_text=None,
):
    payload = {"task_id": task_id, "start": iso(start), "end": iso(end)}
    if interval_id is not None:
        payload["interval_id"] = interval_id
    if excuse_id is not None:
        payload["excuse_id"] = excuse_id
    if new_excuse_text is not None:
        payload["new_excuse_text"] = new_excuse_text
    return client.post("/excuses/attach", json=payload)


def frequency(client, granularity="week", anchor=WEEK_START, task_ids=None):
    params = [("granularity", granularity), ("date", anchor)]
    for task_id in task_ids or []:
        params.append(("task_ids", task_id))
    response = client.get("/excuses/frequency", params=params)
    assert response.status_code == 200
    return response.json()


def test_list_excuses_starts_empty(client):
    response = client.get("/excuses")
    assert response.status_code == 200
    assert response.json() == []


def test_attach_with_new_text_creates_and_lists_excuse(client):
    task = create_leaf(client, "Write report")
    response = attach(
        client, task["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["excuse_text"] == "Got distracted"
    assert body["task_id"] == task["id"]

    listed = client.get("/excuses").json()
    assert [excuse["text"] for excuse in listed] == ["Got distracted"]


def test_attach_with_excuse_id_reuses_it(client):
    task = create_leaf(client, "Write report")
    first = attach(
        client, task["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted"
    )
    excuse_id = first.json()["excuse_id"]

    second = attach(
        client,
        task["id"],
        START + timedelta(hours=2),
        START + timedelta(hours=3),
        excuse_id=excuse_id,
    )
    assert second.status_code == 200
    assert second.json()["excuse_id"] == excuse_id
    assert len(client.get("/excuses").json()) == 1


def test_attach_with_duplicate_text_reuses_existing_excuse(client):
    task = create_leaf(client, "Write report")
    first = attach(
        client, task["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted"
    )
    excuse_id = first.json()["excuse_id"]

    second = attach(
        client,
        task["id"],
        START + timedelta(hours=2),
        START + timedelta(hours=3),
        new_excuse_text="  GOT DISTRACTED  ",
    )
    assert second.status_code == 200
    assert second.json()["excuse_id"] == excuse_id
    assert len(client.get("/excuses").json()) == 1


def test_reattaching_same_gap_updates_in_place(client):
    task = create_leaf(client, "Write report")
    gap_start = START
    gap_end = START + timedelta(hours=1)

    first = attach(client, task["id"], gap_start, gap_end, new_excuse_text="Got distracted")
    second = attach(client, task["id"], gap_start, gap_end, new_excuse_text="Meeting ran over")

    assert second.json()["id"] == first.json()["id"]
    assert second.json()["excuse_text"] == "Meeting ran over"

    body = frequency(client)
    assert [row["excuse_text"] for row in body["totals"]] == ["Meeting ran over"]
    assert body["totals"][0]["count"] == 1


def test_attach_requires_exactly_one_selector(client):
    task = create_leaf(client, "Write report")

    neither = attach(client, task["id"], START, START + timedelta(hours=1))
    assert neither.status_code == 400

    both = attach(
        client,
        task["id"],
        START,
        START + timedelta(hours=1),
        excuse_id="whatever",
        new_excuse_text="Got distracted",
    )
    assert both.status_code == 400


def test_attach_unknown_task_id_returns_404(client):
    response = attach(
        client,
        "does-not-exist",
        START,
        START + timedelta(hours=1),
        new_excuse_text="Got distracted",
    )
    assert response.status_code == 404


def test_attach_unknown_excuse_id_returns_404(client):
    task = create_leaf(client, "Write report")
    response = attach(
        client, task["id"], START, START + timedelta(hours=1), excuse_id="does-not-exist"
    )
    assert response.status_code == 404


def test_frequency_totals_and_by_task_breakdown(client):
    task_a = create_leaf(client, "Task A")
    task_b = create_leaf(client, "Task B")

    attach(
        client, task_a["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted"
    )
    r = attach(
        client,
        task_a["id"],
        START + timedelta(hours=2),
        START + timedelta(hours=3),
        new_excuse_text="Got distracted",
    )
    excuse_id = r.json()["excuse_id"]
    attach(
        client,
        task_b["id"],
        START + timedelta(hours=4),
        START + timedelta(hours=5),
        excuse_id=excuse_id,
    )

    body = frequency(client)
    assert body["period_start"] == WEEK_START
    assert body["period_end"] == NEXT_WEEK_START
    assert body["totals"] == [{"excuse_id": excuse_id, "excuse_text": "Got distracted", "count": 3}]

    by_task = {(row["task_id"], row["excuse_id"]): row["count"] for row in body["by_task"]}
    assert by_task[(task_a["id"], excuse_id)] == 2
    assert by_task[(task_b["id"], excuse_id)] == 1


def test_frequency_respects_task_ids_filter(client):
    task_a = create_leaf(client, "Task A")
    task_b = create_leaf(client, "Task B")

    attach(
        client, task_a["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted"
    )
    attach(
        client,
        task_b["id"],
        START + timedelta(hours=2),
        START + timedelta(hours=3),
        new_excuse_text="Meeting ran over",
    )

    body = frequency(client, task_ids=[task_a["id"]])
    assert [row["excuse_text"] for row in body["totals"]] == ["Got distracted"]


def test_frequency_excludes_attachments_outside_the_period(client):
    task = create_leaf(client, "Write report")
    attach(client, task["id"], START, START + timedelta(hours=1), new_excuse_text="Got distracted")

    body = frequency(client, anchor=NEXT_WEEK_START)
    assert body["totals"] == []
    assert body["by_task"] == []
