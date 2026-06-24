"""Simulation tick scheduler (Phase 1).

Wraps an APScheduler AsyncIOScheduler that fires `daily_loop.run_tick()` every
TICK_INTERVAL_SECONDS. max_instances=1 guarantees two ticks never overlap.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from core.config import settings
from simulation.daily_loop import run_tick
from sim_router import _tick as world_tick, seed_steeve, TICK_SECONDS as WORLD_TICK_SECONDS

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    """Register the tick jobs and start the scheduler.

    Two jobs share this single AsyncIOScheduler (one event loop, no competing
    asyncio task):
      - daily_tick: the heavyweight daily-life sim (every TICK_INTERVAL_SECONDS).
      - world_tick: the fast 3D-movement sim for the /world3d scene.
    """
    _scheduler.add_job(
        run_tick,
        trigger="interval",
        seconds=settings.TICK_INTERVAL_SECONDS,
        id="daily_tick",
        max_instances=1,        # critical: never run two ticks simultaneously
        misfire_grace_time=30,
        replace_existing=True,
    )

    # World movement tick — drives Steeve toward his target a little each tick
    # and asks Claude for a new action every DECISION_EVERY_TICKS. Integrated
    # into the existing scheduler (per project convention) rather than spawning
    # a second asyncio loop via start_sim(). max_instances=1 keeps movement
    # ticks from overlapping the occasional awaited Claude call; coalesce drops
    # any backlog so we never replay stale ticks.
    seed_steeve()
    _scheduler.add_job(
        world_tick,
        trigger="interval",
        seconds=WORLD_TICK_SECONDS,
        id="world_tick",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=1,
        replace_existing=True,
    )

    _scheduler.start()
    logger.info(
        "Tick scheduler started (daily=%ss, world=%ss)",
        settings.TICK_INTERVAL_SECONDS,
        WORLD_TICK_SECONDS,
    )


def stop_scheduler() -> None:
    """Stop the scheduler without waiting for in-flight jobs."""
    _scheduler.shutdown(wait=False)
    logger.info("Tick scheduler stopped")
