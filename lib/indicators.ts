export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [seed];

  for (const price of values.slice(period)) {
    out.push((price - out[out.length - 1]) * multiplier + out[out.length - 1]);
  }

  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? Math.abs(delta) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i += 1) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): { macd: number; signal: number } {
  if (values.length < slow + signalPeriod) return { macd: 0, signal: 0 };

  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  if (!fastEma.length || !slowEma.length) return { macd: 0, signal: 0 };

  const offset = fastEma.length - slowEma.length;
  const alignedFast = fastEma.slice(offset);
  const macdLine = alignedFast.map((v, i) => v - slowEma[i]);
  const signalLine = ema(macdLine, signalPeriod);

  return {
    macd: macdLine[macdLine.length - 1] ?? 0,
    signal: signalLine[signalLine.length - 1] ?? 0,
  };
}
