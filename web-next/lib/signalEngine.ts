import { ema, macd, rsi } from "./indicators";
import type { SignalRow, Signal, Strength } from "./types";

const toStrength = (score: number): Strength => {
  if (score >= 6) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
};

const volatilityPct = (closes: number[]): number => {
  const tail = closes.slice(-24);
  if (tail.length < 3) return 0;
  const moves: number[] = [];
  for (let i = 1; i < tail.length; i += 1) {
    const prev = tail[i - 1];
    if (prev === 0) continue;
    moves.push(Math.abs(((tail[i] - prev) / prev) * 100));
  }
  return moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0;
};

const riskProfile = (signal: Signal, valueRsi: number, vol: number): { level: Strength; score: number; stop: string } => {
  let score = Math.round(25 + vol * 16);

  if (valueRsi >= 72 || valueRsi <= 28) score += 18;
  else if (valueRsi >= 67 || valueRsi <= 33) score += 10;
  if (signal === "HOLD") score += 8;

  score = Math.max(5, Math.min(95, score));

  const level: Strength = score >= 68 ? "HIGH" : score >= 38 ? "MEDIUM" : "LOW";
  if (signal === "HOLD") {
    return { level, score, stop: "Stop-loss acmaq ucun deqiq trade yoxdur" };
  }

  const base = Math.max(0.8, Math.min(4.8, vol * 1.7 + score / 95));
  const low = Math.max(0.6, Number((base * 0.8).toFixed(2)));
  const high = Math.min(6.8, Number((base * 1.25).toFixed(2)));
  return { level, score, stop: `${low}% - ${high}%` };
};

export function buildSignal(symbol: string, interval: string, closes: number[], timestampIso: string): SignalRow {
  const emaFastSeries = ema(closes, 20);
  const emaSlowSeries = ema(closes, 50);
  const sparkline = closes.slice(-20);

  if (!emaFastSeries.length || !emaSlowSeries.length) {
    return {
      symbol,
      signal: "HOLD",
      strength: "LOW",
      score: 0,
      reasons: ["Hec yeterli sayda candle yoxdur"],
      sparkline,
      risk_level: "LOW",
      risk_score: 10,
      stop_loss_range: "Stop-loss acmaq ucun deqiq trade yoxdur",
      snapshot: {
        close_price: closes.at(-1) ?? 0,
        rsi: 50,
        macd: 0,
        macd_signal: 0,
        timestamp: timestampIso,
      },
    };
  }

  const price = closes.at(-1) ?? 0;
  const emaFast = emaFastSeries.at(-1) ?? 0;
  const emaSlow = emaSlowSeries.at(-1) ?? 0;
  const valueRsi = rsi(closes);
  const { macd: valueMacd, signal: valueMacdSignal } = macd(closes);

  let buy = 0;
  let sell = 0;
  const reasons: string[] = [];

  if (price > emaFast && emaFast > emaSlow) {
    buy += 2;
    reasons.push("Qiymet EMA20 ve EMA50 ustundedir");
  } else if (price < emaFast && emaFast < emaSlow) {
    sell += 2;
    reasons.push("Qiymet EMA20 ve EMA50 altindadir");
  }

  if (valueMacd > valueMacdSignal) {
    buy += 2;
    reasons.push("MACD siqnal xettinin ustune kecib");
  } else if (valueMacd < valueMacdSignal) {
    sell += 2;
    reasons.push("MACD siqnal xettinin altina dusub");
  }

  if (valueRsi >= 45 && valueRsi <= 65) {
    buy += 1;
    reasons.push("RSI trend ucun normal zonadadir");
  }
  if (valueRsi >= 70) {
    sell += 1;
    reasons.push("RSI bazarin artiq alinmis oldugunu gosterir");
  }
  if (valueRsi <= 30) {
    buy += 1;
    reasons.push("RSI bazarin artiq satildigini ve rebound sansini gosterir");
  }

  let signal: Signal = "HOLD";
  let score = Math.max(buy, sell);

  if (buy >= sell + 2 && buy >= 4) {
    signal = "BUY";
    score = buy;
  } else if (sell >= buy + 2 && sell >= 4) {
    signal = "SELL";
    score = sell;
  }

  const strength = toStrength(score);
  const risk = riskProfile(signal, valueRsi, volatilityPct(closes));

  return {
    symbol,
    signal,
    strength,
    score,
    reasons: reasons.length ? reasons : ["Aydin istiqamet siqnali yoxdur"],
    sparkline,
    risk_level: risk.level,
    risk_score: risk.score,
    stop_loss_range: risk.stop,
    snapshot: {
      close_price: price,
      rsi: valueRsi,
      macd: valueMacd,
      macd_signal: valueMacdSignal,
      timestamp: timestampIso,
    },
  };
}
