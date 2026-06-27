import { NextResponse } from "next/server";
import { buildSignal } from "@/lib/signalEngine";
import type { SignalRow } from "@/lib/types";

const BINANCE_BASE_URLS = [
  process.env.BINANCE_BASE_URL,
  "https://data-api.binance.vision",
  "https://api1.binance.com",
  "https://api.binance.com",
].filter(Boolean) as string[];

const interval = process.env.INTERVAL ?? "15m";
const lookback = Number(process.env.LOOKBACK ?? "200");
const symbols = (process.env.SYMBOLS ?? "BTCUSDT,ETHUSDT,SOLUSDT")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
const telegramChatIds = [
  ...(process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  ...(process.env.TELEGRAM_CHAT_ID ? [process.env.TELEGRAM_CHAT_ID.trim()] : []),
].filter((v, i, arr) => arr.indexOf(v) === i);
const telegramEnabled = Boolean(telegramBotToken && telegramChatIds.length > 0);

const previousSignals = new Map<string, SignalRow>();
let history: Array<{ symbol: string; signal: string; strength: string; price: number; timestamp: string; reasons: string[] }> = [];
let alerts: Array<{ level: string; symbol: string; title: string; message: string; timestamp: string }> = [];

async function fetchCloses(symbol: string): Promise<{ closes: number[]; timestamp: string }> {
  const tried: string[] = [];

  for (const baseUrl of BINANCE_BASE_URLS) {
    const url = new URL(`${baseUrl}/api/v3/klines`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(lookback));

    const res = await fetch(url.toString(), {
      next: { revalidate: 0 },
      headers: {
        "user-agent": "trade-signal-notifier/1.0",
      },
    });

    if (res.ok) {
      const rows = (await res.json()) as Array<[number, string, string, string, string, string, number]>;
      const closes = rows.map((r) => Number(r[4]));
      const ts = rows.at(-1)?.[6] ?? Date.now();
      return { closes, timestamp: new Date(ts).toISOString() };
    }

    tried.push(`${baseUrl} => ${res.status}`);

    // 4xx except 451 generally means malformed input and retrying other hosts won't help much.
    if (res.status >= 400 && res.status < 500 && res.status !== 451) {
      throw new Error(`Binance xetasi: ${res.status}`);
    }
  }

  throw new Error(`Binance xetasi: fallback hostlar da islemedi (${tried.join(" | ")})`);
}

function pushAlert(alert: { level: string; symbol: string; title: string; message: string; timestamp: string }) {
  alerts.unshift(alert);
  alerts = alerts.slice(0, 120);
}

async function sendTelegramAlerts(cycleAlerts: Array<{ level: string; symbol: string; title: string; message: string; timestamp: string }>) {
  if (!telegramEnabled || cycleAlerts.length === 0) {
    return;
  }

  const lines = ["Trade Signal Xeberdarliq", ""];
  for (const item of cycleAlerts.slice(0, 8)) {
    lines.push(`${item.symbol} | ${item.title}`);
    lines.push(item.message);
    lines.push(new Date(item.timestamp).toLocaleString("az-AZ"));
    lines.push("");
  }

  const text = lines.join("\n").trim();
  const sends = telegramChatIds.map(async (chatId) => {
    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`chat ${chatId}: ${res.status} ${errText}`);
    }
  });

  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`Telegram gondermede xeta: ${failed.length}/${results.length}`);
  }
}

export async function GET() {
  try {
    const list: SignalRow[] = [];
    const cycleAlerts: Array<{ level: string; symbol: string; title: string; message: string; timestamp: string }> = [];

    for (const symbol of symbols) {
      const { closes, timestamp } = await fetchCloses(symbol);
      const signal = buildSignal(symbol, interval, closes, timestamp);
      const prev = previousSignals.get(symbol);
      previousSignals.set(symbol, signal);
      list.push(signal);

      if (signal.signal === "BUY" || signal.signal === "SELL") {
        const prevSignal = prev?.signal;
        if (prevSignal !== signal.signal) {
          history.unshift({
            symbol,
            signal: signal.signal,
            strength: signal.strength,
            price: signal.snapshot.close_price,
            timestamp,
            reasons: signal.reasons,
          });
          history = history.slice(0, 100);
        }
      }

      if (prev) {
        if (prev.signal !== signal.signal) {
          const alert = {
            level: "INFO",
            symbol,
            title: "Siqnal deyisdi",
            message: `${prev.signal} -> ${signal.signal}`,
            timestamp,
          };
          pushAlert(alert);
          cycleAlerts.push(alert);
        }

        if (signal.score >= prev.score + 2 && (signal.signal === "BUY" || signal.signal === "SELL")) {
          const alert = {
            level: signal.signal === "BUY" ? "GOOD" : "WARN",
            symbol,
            title: "Momentum guclendi",
            message: `Skor ${prev.score}-den ${signal.score}-e qalxdi`,
            timestamp,
          };
          pushAlert(alert);
          cycleAlerts.push(alert);
        }
      }
    }

    await sendTelegramAlerts(cycleAlerts);

    const buyCount = list.filter((x) => x.signal === "BUY").length;
    const sellCount = list.filter((x) => x.signal === "SELL").length;
    const holdCount = list.filter((x) => x.signal === "HOLD").length;

    let dominant = "HOLD";
    if (buyCount > sellCount && buyCount >= holdCount) dominant = "BUY";
    else if (sellCount > buyCount && sellCount >= holdCount) dominant = "SELL";

    const opportunities = list
      .filter((x) => x.signal !== "HOLD")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => ({
        symbol: x.symbol,
        signal: x.signal,
        strength: x.strength,
        score: x.score,
        risk: x.risk_level,
        stop_loss: x.stop_loss_range,
        reason: x.reasons[0] ?? "Sebeb yoxdur",
      }));

    return NextResponse.json({
      symbols,
      interval,
      last_updated: new Date().toISOString(),
      signals: list,
      history,
      alerts,
      opportunities,
      market_pulse: {
        buy_count: buyCount,
        sell_count: sellCount,
        hold_count: holdCount,
        dominant,
      },
      telegram_enabled: telegramEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
