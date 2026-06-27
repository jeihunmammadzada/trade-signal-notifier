from dataclasses import dataclass
import os


def _read_symbols() -> list[str]:
    raw = os.getenv("SYMBOLS", "BTCUSDT,ETHUSDT,SOLUSDT")
    return [part.strip().upper() for part in raw.split(",") if part.strip()]


@dataclass(frozen=True)
class Settings:
    symbols: list[str]
    interval: str
    lookback: int
    refresh_seconds: int
    telegram_bot_token: str
    telegram_chat_id: str


settings = Settings(
    symbols=_read_symbols(),
    interval=os.getenv("INTERVAL", "15m"),
    lookback=int(os.getenv("LOOKBACK", "200")),
    refresh_seconds=int(os.getenv("REFRESH_SECONDS", "600")),
    telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
    telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", ""),
)
