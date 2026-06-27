from datetime import datetime, timezone

import requests


class BinanceDataProvider:
    base_url = "https://api.binance.com"

    def get_closes(self, symbol: str, interval: str, limit: int) -> tuple[datetime, list[float]]:
        response = requests.get(
            f"{self.base_url}/api/v3/klines",
            params={"symbol": symbol, "interval": interval, "limit": limit},
            timeout=12,
        )
        response.raise_for_status()
        candles = response.json()

        close_time_ms = int(candles[-1][6])
        closes = [float(candle[4]) for candle in candles]
        timestamp = datetime.fromtimestamp(close_time_ms / 1000, tz=timezone.utc)
        return timestamp, closes
