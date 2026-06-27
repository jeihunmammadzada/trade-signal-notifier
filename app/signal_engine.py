from app.indicators import ema, macd, rsi
from app.models import MarketSnapshot, TradeSignal


class SignalEngine:
    @staticmethod
    def _calc_volatility_pct(closes: list[float], window: int = 24) -> float:
        if len(closes) < 3:
            return 0.0

        tail = closes[-window:]
        moves: list[float] = []
        for prev, cur in zip(tail[:-1], tail[1:]):
            if prev == 0:
                continue
            moves.append(abs((cur - prev) / prev) * 100)

        if not moves:
            return 0.0
        return sum(moves) / len(moves)

    @staticmethod
    def _risk_profile(signal: str, latest_rsi: float, volatility_pct: float) -> tuple[str, int, str]:
        risk_score = int(25 + (volatility_pct * 16))

        if latest_rsi >= 72 or latest_rsi <= 28:
            risk_score += 18
        elif latest_rsi >= 67 or latest_rsi <= 33:
            risk_score += 10

        if signal == "HOLD":
            risk_score += 8

        risk_score = max(5, min(95, risk_score))

        if risk_score >= 68:
            risk_level = "HIGH"
        elif risk_score >= 38:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        if signal not in {"BUY", "SELL"}:
            return risk_level, risk_score, "Stop-loss acmaq ucun deqiq trade yoxdur"

        base = max(0.8, min(4.8, (volatility_pct * 1.7) + (risk_score / 95)))
        low = max(0.6, round(base * 0.8, 2))
        high = min(6.8, round(base * 1.25, 2))
        stop_loss_range = f"{low}% - {high}%"
        return risk_level, risk_score, stop_loss_range

    def evaluate(self, symbol: str, interval: str, timestamp, closes: list[float]) -> TradeSignal:
        ema_fast_series = ema(closes, 20)
        ema_slow_series = ema(closes, 50)
        sparkline = closes[-20:]

        if not ema_fast_series or not ema_slow_series:
            snapshot = MarketSnapshot(
                symbol=symbol,
                interval=interval,
                timestamp=timestamp,
                close_price=closes[-1],
                ema_fast=0.0,
                ema_slow=0.0,
                rsi=50.0,
                macd=0.0,
                macd_signal=0.0,
            )
            return TradeSignal(
                symbol=symbol,
                signal="HOLD",
                strength="LOW",
                score=0,
                reasons=["Hec yeterli sayda candle yoxdur"],
                sparkline=sparkline,
                risk_level="LOW",
                risk_score=10,
                stop_loss_range="Stop-loss acmaq ucun deqiq trade yoxdur",
                snapshot=snapshot,
            )

        ema_fast = ema_fast_series[-1]
        ema_slow = ema_slow_series[-1]
        latest_rsi = rsi(closes)
        latest_macd, latest_macd_signal = macd(closes)
        price = closes[-1]

        snapshot = MarketSnapshot(
            symbol=symbol,
            interval=interval,
            timestamp=timestamp,
            close_price=price,
            ema_fast=ema_fast,
            ema_slow=ema_slow,
            rsi=latest_rsi,
            macd=latest_macd,
            macd_signal=latest_macd_signal,
        )

        buy_score = 0
        sell_score = 0
        reasons: list[str] = []

        if price > ema_fast > ema_slow:
            buy_score += 2
            reasons.append("Qiymet EMA20 ve EMA50 ustundedir")
        elif price < ema_fast < ema_slow:
            sell_score += 2
            reasons.append("Qiymet EMA20 ve EMA50 altindadir")

        if latest_macd > latest_macd_signal:
            buy_score += 2
            reasons.append("MACD siqnal xettinin ustune kecib")
        elif latest_macd < latest_macd_signal:
            sell_score += 2
            reasons.append("MACD siqnal xettinin altina dusub")

        if 45 <= latest_rsi <= 65:
            buy_score += 1
            reasons.append("RSI trend ucun normal zonadadir")
        if latest_rsi >= 70:
            sell_score += 1
            reasons.append("RSI bazarin artiq alinmis oldugunu gosterir")
        if latest_rsi <= 30:
            buy_score += 1
            reasons.append("RSI bazarin artiq satildigini ve rebound sansini gosterir")

        if buy_score >= sell_score + 2 and buy_score >= 4:
            signal = "BUY"
            score = buy_score
        elif sell_score >= buy_score + 2 and sell_score >= 4:
            signal = "SELL"
            score = sell_score
        else:
            signal = "HOLD"
            score = max(buy_score, sell_score)

        strength = "LOW"
        if score >= 6:
            strength = "HIGH"
        elif score >= 4:
            strength = "MEDIUM"

        volatility_pct = self._calc_volatility_pct(closes)
        risk_level, risk_score, stop_loss_range = self._risk_profile(signal, latest_rsi, volatility_pct)

        return TradeSignal(
            symbol=symbol,
            signal=signal,
            strength=strength,
            score=score,
            reasons=reasons or ["Aydin istiqamet siqnali yoxdur"],
            sparkline=sparkline,
            risk_level=risk_level,
            risk_score=risk_score,
            stop_loss_range=stop_loss_range,
            snapshot=snapshot,
        )
