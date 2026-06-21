"""Simulation tick scheduler.

Wraps an APScheduler AsyncIOScheduler that fires `daily_loop.run_tick()`
every TICK_INTERVAL_SECONDS. Started on app startup and stopped on shutdown.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import settings
from simulation import daily_loop

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_TICK_JOB_ID = "simulation_tick"


def start_scheduler() -> AsyncIOScheduler:
    """Create (if needed) and start the simulation scheduler.

    Idempotent: calling twice will not register duplicate jobs.
    """
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        logger.info("Scheduler already running")
        return _scheduler

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        daily_loop.run_tick,
        trigger="interval",
        seconds=settings.TICK_INTERVAL_SECONDS,
        id=_TICK_JOB_ID,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "Tick scheduler started (interval=%ss)", settings.TICK_INTERVAL_SECONDS
    )
    return _scheduler


def stop_scheduler() -> None:
    """Stop the scheduler if it is running."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Tick scheduler stopped")
    _scheduler = None
