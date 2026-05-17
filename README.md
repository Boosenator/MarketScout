# MarketScout

AI market intelligence pipeline that scans configured markets, generates and filters startup ideas, stores results in Supabase, and posts the strongest ideas to Telegram for team voting.

## Stack

- Next.js 14 App Router API routes
- TypeScript strict mode
- Supabase Postgres
- Anthropic Messages API
- Telegram Bot API via Telegraf
- Vercel Cron

## Local setup

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm run dev
```

Apply `supabase/migrations/001_init.sql` to your Supabase project before running the cron pipeline.

## API

- `GET /api/cron/scout` runs the full scout pipeline. Requires `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`.
- `POST /api/telegram` handles Telegram webhook updates.

Configure the webhook once:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/telegram"
```
