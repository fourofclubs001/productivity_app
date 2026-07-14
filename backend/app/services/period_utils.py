from datetime import date, timedelta
from enum import Enum

from app.repositories.interval_repository import monday_of


class Granularity(str, Enum):
    day = "day"
    week = "week"
    month = "month"


def period_bounds(granularity: Granularity, anchor: date) -> tuple[date, date]:
    """Returns [start, end) for the period containing `anchor`, end exclusive."""
    if granularity == Granularity.day:
        return anchor, anchor + timedelta(days=1)
    if granularity == Granularity.week:
        start = monday_of(anchor)
        return start, start + timedelta(days=7)

    start = anchor.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end
