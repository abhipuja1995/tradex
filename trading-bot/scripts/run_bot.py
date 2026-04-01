"""Entry point: starts FastAPI server + Trading Engine + Telegram Bot concurrently."""

import asyncio
import logging
import sys
import threading
from pathlib import Path

import uvicorn

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(),
        ],
    )


def start_api_server():
    """Run FastAPI in a background thread."""
    port = settings.effective_port
    uvicorn.run(
        "api.server:app",
        host=settings.fastapi_host,
        port=port,
        log_level="info",
    )


async def daily_brief_scheduler(telegram_bot):
    """Send daily brief at 8:45 AM and 10:00 AM IST every day."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    sched_logger = logging.getLogger("scheduler")
    ist = ZoneInfo("Asia/Kolkata")

    # Schedule times (hour, minute) in IST
    SCHEDULE_TIMES = [(8, 45), (10, 0)]

    sent_today: set[tuple[str, int, int]] = set()

    sched_logger.info(
        f"Daily brief scheduler started — will send at "
        f"{', '.join(f'{h}:{m:02d}' for h, m in SCHEDULE_TIMES)} IST"
    )

    while True:
        now = datetime.now(ist)
        today_key = now.strftime("%Y-%m-%d")

        for sched_h, sched_m in SCHEDULE_TIMES:
            key = (today_key, sched_h, sched_m)
            if key in sent_today:
                continue

            # Check if we're within the 2-minute window after scheduled time
            if now.hour == sched_h and sched_m <= now.minute < sched_m + 2:
                sched_logger.info(f"Triggering daily brief for {sched_h}:{sched_m:02d} IST")
                try:
                    success = await telegram_bot.send_daily_brief()
                    if success:
                        sched_logger.info(f"Daily brief sent successfully at {now.strftime('%H:%M')} IST")
                    else:
                        sched_logger.warning(f"Daily brief returned False at {now.strftime('%H:%M')} IST")
                except Exception as e:
                    sched_logger.error(f"Daily brief scheduler error: {e}", exc_info=True)
                sent_today.add(key)

        # Clean up old entries at midnight
        current_date = now.strftime("%Y-%m-%d")
        sent_today = {k for k in sent_today if k[0] == current_date}

        # Check every 30 seconds
        await asyncio.sleep(30)


async def main():
    setup_logging()
    logger = logging.getLogger("run_bot")

    port = settings.effective_port

    logger.info("=" * 60)
    logger.info("TRADEX MICRO-TRADING BOT")
    logger.info(f"Mode: {'PAPER' if settings.paper_trading else 'LIVE'}")
    logger.info(f"Daily cap: ₹{settings.daily_cap_inr}")
    logger.info(f"Per trade: ₹{settings.per_trade_cap_inr}")
    logger.info(f"Max trades/day: {settings.max_trades_per_day}")
    logger.info(f"Market hours: {settings.market_open} - {settings.market_close} IST")
    logger.info(f"API server: http://{settings.fastapi_host}:{port}")
    logger.info(f"Dhan configured: {bool(settings.dhan_client_id)}")
    logger.info(f"Telegram configured: {bool(settings.telegram_bot_token)}")
    logger.info("=" * 60)

    # Start FastAPI server in background thread FIRST (so healthcheck passes)
    api_thread = threading.Thread(target=start_api_server, daemon=True)
    api_thread.start()
    logger.info(f"FastAPI server started on port {port}")

    # Give FastAPI a moment to bind
    await asyncio.sleep(2)

    # Initialize Telegram bot
    from core.telegram_bot import TelegramBot
    telegram_bot = TelegramBot()

    # Initialize engine
    from core.engine import TradingEngine
    from api.server import set_engine

    engine = TradingEngine()
    engine.alerter = telegram_bot  # Inject telegram bot as alerter
    set_engine(engine)
    telegram_bot.set_engine(engine)

    # Start engine + telegram bot + scheduler concurrently
    tasks = []

    # Telegram bot polling (always start if token is available)
    if telegram_bot.enabled:
        tasks.append(asyncio.create_task(telegram_bot.start_polling()))
        logger.info("Telegram bot polling started")

        # Daily brief scheduler (runs alongside bot)
        tasks.append(asyncio.create_task(daily_brief_scheduler(telegram_bot)))
        logger.info("Daily brief scheduler started (8:45 AM + 10:00 AM IST)")
    else:
        logger.info("Telegram bot disabled (no TELEGRAM_BOT_TOKEN)")

    # Trading engine
    try:
        engine_task = asyncio.create_task(engine.start())
        tasks.append(engine_task)
        logger.info("Trading engine starting...")

        # Wait for all tasks
        await asyncio.gather(*tasks, return_exceptions=True)

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
        await engine.shutdown()
        await telegram_bot.stop_polling()
    except Exception as e:
        logger.error(f"Engine failed to start: {e}", exc_info=True)
        logger.info("Engine offline. FastAPI + Telegram bot still running.")

        # Keep process alive for healthcheck and Telegram commands
        if telegram_bot.enabled:
            await telegram_bot.send_message(
                f"⚠️ <b>Engine failed to start</b>\n{str(e)[:200]}\n\n"
                "FastAPI & Telegram bot are still running."
            )
            # Keep polling Telegram
            await telegram_bot.start_polling()
        else:
            while True:
                await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
