"""Simulation tick scheduler (Phase 1).

Wraps an APScheduler AsyncIOScheduler that fires `daily_loop.run_tick()` every
TICK_INTERVAL_SECONDS. max_instances=1 guarantees two ticks never overlap.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import settings
from simulation.daily_loop import run_tick

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    """Register the tick job and start the scheduler."""
    _scheduler.add_job(
        run_tick,
        trigger="interval",
        seconds=settings.TICK_INTERVAL_SECONDS,
        id="daily_tick",
        max_instances=1,        # critical: never run two ticks simultaneously
        misfire_grace_time=30,
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Tick scheduler started (interval=%ss)", settings.TICK_INTERVAL_SECONDS)


def stop_scheduler() -> None:
    """Stop the scheduler without waiting for in-flight jobs."""
    _scheduler.shutdown(wait=False)
    logger.info("Tick scheduler stopped")
