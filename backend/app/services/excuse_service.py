from collections import defaultdict
from datetime import UTC, date, datetime
from uuid import uuid4

from app.models.excuse import (
    ExcuseAttachmentOut,
    ExcuseFrequencyByTask,
    ExcuseFrequencyResult,
    ExcuseFrequencyRow,
    ExcuseOut,
)
from app.repositories.excuse_repository import ExcuseRepository
from app.repositories.task_repository import TaskRepository
from app.services.errors import ExcuseNotFoundError, ExcuseSelectionRequiredError, TaskNotFoundError
from app.services.period_utils import Granularity, period_bounds


class ExcuseService:
    def __init__(self, excuse_repo: ExcuseRepository, task_repo: TaskRepository) -> None:
        self._excuses = excuse_repo
        self._tasks = task_repo

    async def list_excuses(self) -> list[ExcuseOut]:
        excuses = await self._excuses.list_excuses()
        results = [ExcuseOut(id=data["id"], text=data["text"]) for data in excuses]
        results.sort(key=lambda excuse: excuse.text.lower())
        return results

    async def attach(
        self,
        task_id: str,
        interval_id: str | None,
        start: datetime,
        end: datetime,
        excuse_id: str | None = None,
        new_excuse_text: str | None = None,
    ) -> ExcuseAttachmentOut:
        if bool(excuse_id) == bool(new_excuse_text):
            raise ExcuseSelectionRequiredError()
        if not await self._tasks.exists(task_id):
            raise TaskNotFoundError(task_id)

        now = datetime.now(UTC)

        if excuse_id:
            excuse = await self._excuses.get_excuse(excuse_id)
            if excuse is None:
                raise ExcuseNotFoundError(excuse_id)
            resolved_id = excuse_id
            resolved_text = excuse["text"]
        else:
            assert new_excuse_text is not None
            existing_id = await self._excuses.find_excuse_by_text(new_excuse_text)
            if existing_id:
                existing = await self._excuses.get_excuse(existing_id)
                resolved_id = existing_id
                resolved_text = existing["text"] if existing else new_excuse_text
            else:
                resolved_id = str(uuid4())
                await self._excuses.create_excuse(resolved_id, new_excuse_text, now.isoformat())
                resolved_text = new_excuse_text

        start_iso = start.isoformat()
        end_iso = end.isoformat()

        # Re-explaining the same gap (same task + exact time range) updates
        # the existing attachment's excuse in place, rather than creating a
        # duplicate that would double-count frequency for that one gap.
        existing_attachment_id = await self._excuses.find_attachment_by_gap(
            task_id, start_iso, end_iso
        )
        if existing_attachment_id:
            await self._excuses.update_attachment_excuse(existing_attachment_id, resolved_id)
            attachment_id = existing_attachment_id
        else:
            attachment_id = str(uuid4())
            await self._excuses.create_attachment(
                attachment_id,
                resolved_id,
                task_id,
                interval_id,
                start_iso,
                end_iso,
                start.timestamp(),
                now.isoformat(),
            )

        return ExcuseAttachmentOut(
            id=attachment_id,
            excuse_id=resolved_id,
            excuse_text=resolved_text,
            task_id=task_id,
            interval_id=interval_id,
            start=start,
            end=end,
        )

    async def get_frequency(
        self, granularity: Granularity, anchor: date, task_ids: list[str] | None = None
    ) -> ExcuseFrequencyResult:
        start, end = period_bounds(granularity, anchor)
        range_start_dt = datetime(start.year, start.month, start.day, tzinfo=UTC)
        range_end_dt = datetime(end.year, end.month, end.day, tzinfo=UTC)

        attachments = await self._excuses.list_attachments_for_range(
            range_start_dt.timestamp(), range_end_dt.timestamp()
        )
        if task_ids:
            selected = set(task_ids)
            attachments = [a for a in attachments if a["task_id"] in selected]

        totals: dict[str, int] = defaultdict(int)
        by_task_counts: dict[tuple[str, str], int] = defaultdict(int)
        excuse_texts: dict[str, str] = {}

        for attachment in attachments:
            excuse_id = attachment["excuse_id"]
            totals[excuse_id] += 1
            by_task_counts[(attachment["task_id"], excuse_id)] += 1
            if excuse_id not in excuse_texts:
                excuse = await self._excuses.get_excuse(excuse_id)
                excuse_texts[excuse_id] = excuse["text"] if excuse else excuse_id

        graph = await self._tasks.load_graph()

        total_rows = [
            ExcuseFrequencyRow(
                excuse_id=excuse_id, excuse_text=excuse_texts[excuse_id], count=count
            )
            for excuse_id, count in totals.items()
        ]
        total_rows.sort(key=lambda row: (-row.count, row.excuse_text.lower()))

        by_task_rows = []
        for (task_id, excuse_id), count in by_task_counts.items():
            node = graph.get(task_id)
            task_name = node.fields.get("name", task_id) if node else task_id
            by_task_rows.append(
                ExcuseFrequencyByTask(
                    task_id=task_id,
                    task_name=task_name,
                    excuse_id=excuse_id,
                    excuse_text=excuse_texts[excuse_id],
                    count=count,
                )
            )
        by_task_rows.sort(key=lambda row: (row.task_name.lower(), -row.count))

        return ExcuseFrequencyResult(
            period_start=start.isoformat(),
            period_end=end.isoformat(),
            totals=total_rows,
            by_task=by_task_rows,
        )
