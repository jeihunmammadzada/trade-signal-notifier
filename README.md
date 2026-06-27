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

### Telegram auto-subscribe (DB)

Bot-a yazan/qoşulan chat-larin ID-si avtomatik bazaya dusur.

1. `.env.local` daxilinde yaz:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=istifadeciye-gosterilmeyen-secret
```

2. Deploy olunmus URL ucun webhook qur:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<SENIN_DOMAIN>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

3. Bot-a DM/group/channel-da mesaj gelende `chat_id` avtomatik DB-ye yazilir.

4. `GET /api/signals` cavabinda `telegram_subscriber_count` goreceksen.

Qeyd: Vercel serverless fayl sistemi daimi deyil. Uzunmuddetli saxlanma ucun Postgres/KV istifade etmek daha dogrudur.
- Production ucun:

```bash
npm run build
npm run start
```
