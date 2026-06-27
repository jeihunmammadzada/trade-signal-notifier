"use client";

import { useEffect, useMemo, useState } from "react";
import type { SignalsResponse, SignalRow } from "@/lib/types";

const modeKey = "signal_view_mode";

function fmt(value: number, d = 2) {
  return value.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function signalBadge(signal: string) {
  const lower = signal.toLowerCase();
  return <span className={`badge badge-${lower}`}>{signal}</span>;
}

function sparkline(values: number[], signal: string) {
  if (!values?.length) return <span className="empty">Trend yoxdur</span>;

  const width = 92;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const color = signal === "BUY" ? "#1f9d58" : signal === "SELL" ? "#d94841" : "#7e6110";

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function actionText(item: SignalRow) {
  if (item.signal === "BUY") {
    return item.strength === "HIGH"
      ? "Alis fikrine bax. Siqnal gucludur, riski bol."
      : "Alis ola biler, amma ehtiyatli ol.";
  }
  if (item.signal === "SELL") {
    return item.strength === "HIGH"
      ? "Satisa bax. Dusme riski gucludur."
      : "Satisa baxmaq olar, hele tam guclu deyil.";
  }
  return "Hazirda deqiq istiqamet yoxdur, gozlemek yaxsidir.";
}

function riskText(level: string) {
  if (level === "HIGH") return "Yuksek";
  if (level === "MEDIUM") return "Orta";
  return "Asagi";
}

export default function Dashboard() {
  const [payload, setPayload] = useState<SignalsResponse | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [pulse, setPulse] = useState<any>(null);
  const [error, setError] = useState("");
  const [detailed, setDetailed] = useState(false);

  useEffect(() => {
    try {
      setDetailed(localStorage.getItem(modeKey) === "detailed");
    } catch {
      setDetailed(false);
    }
  }, []);

  const loadData = async () => {
    setError("");
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      if (!res.ok) throw new Error("API xetasi");
      const data = await res.json();
      setPayload(data);
      setHistory(data.history ?? []);
      setAlerts(data.alerts ?? []);
      setOpportunities(data.opportunities ?? []);
      setPulse(data.market_pulse ?? null);
    } catch {
      setError("Serverden melumat gelmedi.");
    }
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 600_000);
    return () => clearInterval(id);
  }, []);

  const onToggle = () => {
    const next = !detailed;
    setDetailed(next);
    try {
      localStorage.setItem(modeKey, next ? "detailed" : "simple");
    } catch {
      // ignore
    }
  };

  const dominantBadge = useMemo(() => {
    const signal = pulse?.dominant ?? "HOLD";
    return signalBadge(signal);
  }, [pulse]);

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">Canli Market Izleme</p>
        <h1>Next.js Siqnal Paneli</h1>
        <p className="sub">Python olmadan, tam JS stack ile isleyir.</p>
        <div className="meta">
          <span>Interval: {payload?.interval ?? "-"}</span>
          <span>Son yenilenme: {payload?.last_updated ? new Date(payload.last_updated).toLocaleString() : "-"}</span>
          <span>Telegram: {payload?.telegram_enabled ? "aktiv" : "passiv"}</span>
        </div>
      </header>

      <section className="panel pulse-panel">
        <div className="panel-head"><h2>Bazar Nebzi</h2></div>
        <div className="pulse-grid">
          <div className="pulse-card buy-card"><p>BUY sayi</p><strong>{pulse?.buy_count ?? 0}</strong></div>
          <div className="pulse-card sell-card"><p>SELL sayi</p><strong>{pulse?.sell_count ?? 0}</strong></div>
          <div className="pulse-card hold-card"><p>HOLD sayi</p><strong>{pulse?.hold_count ?? 0}</strong></div>
          <div className="pulse-card"><p>Umumi istiqamet</p><strong>{dominantBadge}</strong></div>
        </div>
        <div className="opportunities">
          <h3>Top 3 Furset</h3>
          <ul>
            {!opportunities.length && <li className="empty">Hazirda aciq furset gorunmur.</li>}
            {opportunities.map((item, idx) => (
              <li key={`${item.symbol}-${idx}`}>
                {item.symbol} - {item.signal} ({item.strength}, skor {item.score})
                <br />
                <small>{item.reason}</small>
                <br />
                <small>Risk: {riskText(item.risk)} | SL: {item.stop_loss}</small>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Indiki Siqnallar</h2>
          <div className="panel-actions">
            <button onClick={onToggle}>{detailed ? "Sade gorunus" : "Genis gorunus"}</button>
            <button onClick={loadData}>Yenile</button>
          </div>
        </div>
        <p className="helper-text">Qisa qayda: BUY = almaq fikrine bax, SELL = satmaq fikrine bax, HOLD = gozle.</p>
        <div className={`table-wrap ${detailed ? "show-detailed" : ""}`}>
          <table>
            <thead>
              <tr>
                <th>Coin</th><th>Signal</th><th>Trend</th><th>Ne Etmeli?</th><th>Risk / Stop</th><th>Sebeb</th>
                <th className="detailed-only">Price</th><th className="detailed-only">Score</th><th className="detailed-only">RSI</th><th className="detailed-only">MACD</th>
              </tr>
            </thead>
            <tbody>
              {!payload?.signals?.length && (
                <tr><td colSpan={detailed ? 10 : 6} className="empty">Hele siqnal yoxdur.</td></tr>
              )}
              {payload?.signals?.map((item) => (
                <tr key={item.symbol}>
                  <td>{item.symbol}</td>
                  <td>{signalBadge(item.signal)}</td>
                  <td>{sparkline(item.sparkline, item.signal)}</td>
                  <td className="action-cell">{actionText(item)}</td>
                  <td>
                    <span className={`risk-pill risk-${item.risk_level.toLowerCase()}`}>{riskText(item.risk_level)} risk ({item.risk_score})</span>
                    <br />
                    <small>SL: {item.stop_loss_range}</small>
                  </td>
                  <td>{item.reasons.join("; ")}</td>
                  <td className="detailed-only">{fmt(item.snapshot.close_price, 4)}</td>
                  <td className="detailed-only">{item.score}</td>
                  <td className="detailed-only">{fmt(item.snapshot.rsi, 2)}</td>
                  <td className="detailed-only">{fmt(item.snapshot.macd, 4)} / {fmt(item.snapshot.macd_signal, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!error && <p className="error">{error}</p>}
      </section>

      <section className="panel history-panel">
        <div className="panel-head"><h2>BUY/SELL Tarixcesi</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vaxt</th><th>Coin</th><th>Signal</th><th>Strength</th><th>Price</th><th>Sebeb</th></tr></thead>
            <tbody>
              {!history.length && <tr><td colSpan={6} className="empty">Hele BUY/SELL tarixcesi yoxdur.</td></tr>}
              {history.map((h, idx) => (
                <tr key={`${h.symbol}-${h.timestamp}-${idx}`}>
                  <td>{new Date(h.timestamp).toLocaleString()}</td>
                  <td>{h.symbol}</td>
                  <td>{signalBadge(h.signal)}</td>
                  <td>{h.strength}</td>
                  <td>{fmt(h.price, 4)}</td>
                  <td>{(h.reasons ?? []).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel history-panel">
        <div className="panel-head"><h2>Agilli Xeberdarliqlar</h2></div>
        <ul className="alert-list">
          {!alerts.length && <li className="empty">Hec yeni xeberdarliq yoxdur.</li>}
          {alerts.slice(0, 8).map((a, idx) => (
            <li key={`${a.symbol}-${a.timestamp}-${idx}`} className={`alert-item alert-${String(a.level || "info").toLowerCase()}`}>
              <p><strong>{a.symbol}</strong> - {a.title}</p>
              <p>{a.message}</p>
              <small>{new Date(a.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
