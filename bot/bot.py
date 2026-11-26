"""Taskon bot: opens the Mini App and handles the basics.

Runs in webhook mode on a small aiohttp server so it fits Railway/Render free
tiers. The bot does not touch the database; all points live in Supabase.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from html import escape

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
WEBAPP_URL = os.environ.get("WEBAPP_URL", "").strip().rstrip("/")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").strip()
PORT = int(os.environ.get("PORT", "8080"))


def resolve_public_url() -> str:
    """This service's own https URL.

    Free hosts only tell you the URL after the first deploy, so fall back to the
    URL they inject into the environment instead of asking for PUBLIC_URL.
    """
    for name in ("PUBLIC_URL", "RENDER_EXTERNAL_URL"):
        value = os.environ.get(name, "").strip().rstrip("/")
        if value:
            return value

    railway = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip().rstrip("/")
    if railway:
        return railway if railway.startswith("https://") else f"https://{railway}"

    fly = os.environ.get("FLY_APP_NAME", "").strip()
    if fly:
        return f"https://{fly}.fly.dev"

    return ""


PUBLIC_URL = resolve_public_url()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("taskon-bot")

if not BOT_TOKEN:
    log.error("BOT_TOKEN is not set")
    sys.exit(1)
if not PUBLIC_URL.startswith("https://"):
    log.error("PUBLIC_URL must be the public https URL of this service")
    sys.exit(1)
if not WEBAPP_URL.startswith("https://"):
    log.error("WEBAPP_URL must be the https URL of the Mini App")
    sys.exit(1)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()


def app_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Open Taskon",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ]
    )


@dp.message(CommandStart())
async def start(message: Message) -> None:
    raw_name = message.from_user.first_name if message.from_user else "there"
    name = escape(raw_name)
    await message.answer(
        f"<b>Hey {name}.</b>\n\n"
        "Taskon is a small club for small tasks. Check in once a day, "
        "finish a few tasks, collect points.\n\n"
        "Points only. They don't buy anything and there is no token.",
        reply_markup=app_keyboard(),
    )


@dp.message(Command("help"))
async def help_command(message: Message) -> None:
    await message.answer(
        "<b>How Taskon works</b>\n\n"
        "1. Open the app and check in daily. Streaks add bonus points.\n"
        "2. Do the tasks on the list. Channel joins are verified by this bot.\n"
        "3. Invite a friend with your link. You get 50 points, they get 25.\n"
        "4. The leaderboard shows the top 100 and your own place.\n\n"
        "Points are only a score inside Taskon. There is nothing to buy, sell or cash out.\n\n"
        "Commands: /start, /help",
        reply_markup=app_keyboard(),
    )


@dp.message()
async def fallback(message: Message) -> None:
    if message.chat.type != "private":
        return
    await message.answer(
        "I only open the app and answer /help. The tasks are inside Taskon.",
        reply_markup=app_keyboard(),
    )


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "taskon-bot"})


async def on_startup(app: web.Application) -> None:
    webhook_url = f"{PUBLIC_URL}/webhook"
    await bot.set_webhook(
        url=webhook_url,
        secret_token=WEBHOOK_SECRET or None,
        drop_pending_updates=True,
        allowed_updates=dp.resolve_used_update_types(),
    )
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Open Taskon"),
            BotCommand(command="help", description="How points and tasks work"),
        ]
    )

    # Shown before the first /start, so a new chat isn't a blank page.
    try:
        await bot.set_my_short_description(
            short_description=(
                "Check in daily, finish small tasks, invite friends. "
                "Points only - no token, nothing to cash out."
            )
        )
        await bot.set_my_description(
            description=(
                "Taskon is a small task-and-points club inside Telegram.\n\n"
                "Check in once a day, finish a few tasks, invite a friend with your "
                "link. Points are only a score inside the app: there is no token "
                "and nothing to buy, sell or withdraw."
            )
        )
    except Exception as exc:  # profile text is cosmetic; never block the webhook
        log.warning("Could not update bot descriptions: %s", exc)

    log.info("Webhook set to %s", webhook_url)


async def on_shutdown(app: web.Application) -> None:
    # Keep the webhook registered: Telegram's retries are what wake a sleeping
    # free-tier service. Only close the HTTP client.
    await bot.session.close()


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", health)
    app.router.add_get("/healthz", health)
    SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=WEBHOOK_SECRET or None,
    ).register(app, path="/webhook")
    setup_application(app, dp, bot=bot)
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)
    return app


if __name__ == "__main__":
    log.info("Starting Taskon bot on port %s", PORT)
    web.run_app(create_app(), host="0.0.0.0", port=PORT, access_log=log)
