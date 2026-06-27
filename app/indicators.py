def ema(values: list[float], period: int) -> list[float]:
    if period <= 0:
        raise ValueError("period must be positive")
    if len(values) < period:
        return []

    multiplier = 2 / (period + 1)
    seed = sum(values[:period]) / period
    results = [seed]

    for price in values[period:]:
        next_value = ((price - results[-1]) * multiplier) + results[-1]
        results.append(next_value)

    return results


def rsi(values: list[float], period: int = 14) -> float:
    if len(values) <= period:
        return 50.0

    gains: list[float] = []
    losses: list[float] = []

    for i in range(1, len(values)):
        delta = values[i] - values[i - 1]
        if delta >= 0:
            gains.append(delta)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(delta))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = ((avg_gain * (period - 1)) + gains[i]) / period
        avg_loss = ((avg_loss * (period - 1)) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(values: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[float, float]:
    if len(values) < slow + signal:
        return 0.0, 0.0

    fast_ema = ema(values, fast)
    slow_ema = ema(values, slow)

    if not fast_ema or not slow_ema:
        return 0.0, 0.0

    offset = len(fast_ema) - len(slow_ema)
    aligned_fast = fast_ema[offset:]
    macd_line = [f - s for f, s in zip(aligned_fast, slow_ema)]

    signal_line_values = ema(macd_line, signal)
    if not signal_line_values:
        return macd_line[-1], 0.0

    return macd_line[-1], signal_line_values[-1]
