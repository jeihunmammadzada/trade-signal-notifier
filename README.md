# Next.js Trading Siqnal Paneli

Bu versiya Python olmadan tam Node.js/Next.js ile isleyir.

## Qurasdirma

```bash
cd web-next
npm install
cp .env.local.example .env.local
npm run dev
```

Sonra ac:

- UI: http://127.0.0.1:3000
- API: http://127.0.0.1:3000/api/signals

## Qeyd

- Telegram alert ucun `.env.local` daxilinde `TELEGRAM_BOT_TOKEN` yaz.
- Bir nece adama gondermek ucun `TELEGRAM_CHAT_IDS` (vergulle ayri) istifade et.
- Geriye uygunluq ucun tek chat da `TELEGRAM_CHAT_ID` ile isleyir.
- Production ucun:

```bash
npm run build
npm run start
```
