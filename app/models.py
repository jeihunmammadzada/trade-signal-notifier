from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Literal

SignalType = Literal["BUY", "SELL", "HOLD"]
SignalStrength = Literal["LOW", "MEDIUM", "HIGH"]


@dataclass
class MarketSnapshot:
    symbol: str
    interval: str
    timestamp: datetime
    close_price: float
    ema_fast: float
    ema_slow: float
    rsi: float
    macd: float
    macd_signal: float


@dataclass
class TradeSignal:
    symbol: str
    signal: SignalType
    strength: SignalStrength
    score: int
    reasons: list[str]
    sparkline: list[float]
    risk_level: SignalStrength
    risk_score: int
    stop_loss_range: str
    snapshot: MarketSnapshot

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["snapshot"]["timestamp"] = self.snapshot.timestamp.isoformat()
        return payload
