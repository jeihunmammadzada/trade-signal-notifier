export type Signal = "BUY" | "SELL" | "HOLD";
export type Strength = "LOW" | "MEDIUM" | "HIGH";

export interface SignalRow {
  symbol: string;
  signal: Signal;
  strength: Strength;
  score: number;
  reasons: string[];
  sparkline: number[];
  risk_level: Strength;
  risk_score: number;
  stop_loss_range: string;
  snapshot: {
    close_price: number;
    rsi: number;
    macd: number;
    macd_signal: number;
    timestamp: string;
  };
}

export interface SignalsResponse {
  interval: string;
  last_updated: string;
  telegram_enabled: boolean;
  signals: SignalRow[];
}
