# Crypto Pre-Signal Trading Dashboard

Bu layihə coin bazarini izləyib alis/satis istiqametini qabaqcadan gormek ucun sadə web paneldir.

## Xususiyyetler

- Binance-dan qiymet datasi cekir
- EMA20/EMA50, RSI, MACD hesablayir
- `BUY` / `SELL` / `HOLD` siqnal verir
- Panelde indiki siqnali gosterir
- BUY/SELL tarixcesini saxlayir
- Her 10 deqiqede bir avtomatik yenilenir
- Trend sparkline (mini qrafik) gosterir
- Risk bali + stop-loss araligi teklifi verir
- Bazar nebzi, top fursetler ve agilli xeberdarliqlar verir
- Telegram aktiv olsa alertleri avtomatik gonderir

## Qurasdirma

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Telegram xeberdarliq ucun `.env` daxilinde bunlari doldur:

```env
TELEGRAM_BOT_TOKEN=bot_tokeniniz
TELEGRAM_CHAT_ID=chat_id
```

## Isletmek

```bash
uvicorn app.main:app --reload
```

Sonra browserde acin:

- Dashboard: http://127.0.0.1:8000
- API: http://127.0.0.1:8000/api/signals

## Qeyd

Bu sistem test ve oyrenme ucundur, maliyye mesleheti deyil.
Real trade etmeden once mutleq:

- daha cox indikator/filtr elave edin
- risk idaresi (stop-loss, position sizing) qurun
- backtest + paper trading edin

## Python qaldira bilmirsense

JS/Node versiya da var: [web-next/README.md](web-next/README.md)
