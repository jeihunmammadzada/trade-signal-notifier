from datetime import datetime, timezone

import requests

from app.config import settings
from app.data_provider import BinanceDataProvider
from app.signal_engine import SignalEngine


class SignalService:
    def __init__(self) -> None:
        self.provider = BinanceDataProvider()
        self.engine = SignalEngine()
        self.latest: dict[str, dict] = {}
        self.history: list[dict] = []
        self.alerts: list[dict] = []
        self.market_pulse: dict = {
            "buy_count": 0,
            "sell_count": 0,
            "hold_count": 0,
            "dominant": "HOLD",
        }
        self.opportunities: list[dict] = []
        self.last_updated: datetime | None = None

    @property
    def telegram_enabled(self) -> bool:
        return bool(settings.telegram_bot_token and settings.telegram_chat_id)

    def _insert_alert(self, cycle_alerts: list[dict], alert: dict) -> None:
        self.alerts.insert(0, alert)
        cycle_alerts.append(alert)

    def _notify_telegram(self, cycle_alerts: list[dict]) -> None:
        if not self.telegram_enabled or not cycle_alerts:
            return

        text_lines = ["Crypto Siqnal Xeberdarliqlari"]
        for item in cycle_alerts[:8]:
            text_lines.append(f"- {item['symbol']} | {item['title']} | {item['message']}")

        try:
            requests.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": settings.telegram_chat_id, "text": "\n".join(text_lines)},
                timeout=12,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Telegram bildirisinde xeta: {exc}")

    def run_cycle(self) -> None:
        cycle_signals: list[dict] = []
        cycle_alerts: list[dict] = []

        for symbol in settings.symbols:
            timestamp, closes = self.provider.get_closes(symbol, settings.interval, settings.lookback)
            signal = self.engine.evaluate(symbol=symbol, interval=settings.interval, timestamp=timestamp, closes=closes)
            signal_payload = signal.to_dict()
            previous = self.latest.get(symbol)
            self.latest[symbol] = signal_payload
            cycle_signals.append(signal_payload)

            if previous:
                prev_signal = previous["signal"]
                prev_score = previous["score"]
                prev_price = float(previous["snapshot"]["close_price"])
                new_price = float(signal_payload["snapshot"]["close_price"])
                price_delta_pct = ((new_price - prev_price) / prev_price) * 100 if prev_price else 0.0

                if prev_signal != signal.signal:
                    self._insert_alert(
                        cycle_alerts,
                        {
                            "level": "INFO",
                            "symbol": symbol,
                            "title": "Siqnal deyisdi",
                            "message": f"{prev_signal} -> {signal.signal}",
                            "timestamp": timestamp.isoformat(),
                        },
                    )

                if signal_payload["score"] >= prev_score + 2 and signal.signal in {"BUY", "SELL"}:
                    self._insert_alert(
                        cycle_alerts,
                        {
                            "level": "GOOD" if signal.signal == "BUY" else "WARN",
                            "symbol": symbol,
                            "title": "Momentum guclendi",
                            "message": f"Skor {prev_score}-den {signal_payload['score']}-e qalxdi",
                            "timestamp": timestamp.isoformat(),
                        },
                    )

                if abs(price_delta_pct) >= 1.2:
                    self._insert_alert(
                        cycle_alerts,
                        {
                            "level": "WARN",
                            "symbol": symbol,
                            "title": "Ani hereket",
                            "message": f"Son yenilenmede {price_delta_pct:.2f}% hereket var",
                            "timestamp": timestamp.isoformat(),
                        },
                    )

            # Keep a simple BUY/SELL log so the user can track when direction changes.
            if signal.signal in {"BUY", "SELL"}:
                previous_signal = previous["signal"] if previous else None
                if previous_signal != signal.signal:
                    self.history.insert(
                        0,
                        {
                            "symbol": symbol,
                            "signal": signal.signal,
                            "strength": signal.strength,
                            "price": signal.snapshot.close_price,
                            "timestamp": signal.snapshot.timestamp.isoformat(),
                            "reasons": signal.reasons,
                        },
                    )

        self.history = self.history[:100]
        self.alerts = self.alerts[:120]
        self._notify_telegram(cycle_alerts)

        buy_count = sum(1 for item in cycle_signals if item["signal"] == "BUY")
        sell_count = sum(1 for item in cycle_signals if item["signal"] == "SELL")
        hold_count = sum(1 for item in cycle_signals if item["signal"] == "HOLD")

        dominant = "HOLD"
        if buy_count > sell_count and buy_count >= hold_count:
            dominant = "BUY"
        elif sell_count > buy_count and sell_count >= hold_count:
            dominant = "SELL"

        self.market_pulse = {
            "buy_count": buy_count,
            "sell_count": sell_count,
            "hold_count": hold_count,
            "dominant": dominant,
        }

        ranked = sorted(
            [
                item
                for item in cycle_signals
                if item["signal"] in {"BUY", "SELL"}
            ],
            key=lambda x: x["score"],
            reverse=True,
        )
        self.opportunities = [
            {
                "symbol": item["symbol"],
                "signal": item["signal"],
                "strength": item["strength"],
                "score": item["score"],
                "risk": item["risk_level"],
                "stop_loss": item["stop_loss_range"],
                "reason": item["reasons"][0] if item["reasons"] else "Sebeb yoxdur",
            }
            for item in ranked[:3]
        ]

        self.last_updated = datetime.now(tz=timezone.utc)

    def get_all(self) -> dict:
        return {
            "symbols": settings.symbols,
            "interval": settings.interval,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "signals": list(self.latest.values()),
            "history": self.history,
            "alerts": self.alerts,
            "market_pulse": self.market_pulse,
            "opportunities": self.opportunities,
            "telegram_enabled": self.telegram_enabled,
        }
