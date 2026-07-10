# Inventory value leaderboard API

Two Vercel serverless functions backing the userscript's "Pricedata Value" leaderboard category.

## Setup

1. Import this repo into Vercel (New Project -> pick `cco-leaderboard-api`). `package.json`
   already declares the `@vercel/kv` dependency, so Vercel installs it automatically at
   build time — no local `npm install` needed unless you want to run it locally too.
2. In the Vercel dashboard: **Storage** tab -> **Create Database** -> **KV**. Connect it to
   this project — Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Deploy.
4. In the userscript, set `CONFIG.LEADERBOARD_API_BASE` to your deployment's base URL, e.g.
   `https://your-project.vercel.app` (no trailing slash). Leave it blank to keep the whole
   leaderboard feature disabled.

## Endpoints

- `POST /api/submit-score` — body `{ userId, username, avatarUrl, totalValue, nativeValue }`.
  Called automatically by the userscript every time you run "Scan All" in-game. Upserts one
  entry per `userId`.
- `GET /api/leaderboard?limit=50` — returns `{ entries: [{ rank, userId, username, avatarUrl,
  totalValue, nativeValue, updatedAt }] }`, sorted by `totalValue` descending.

## Notes / things you may want to change

- CORS is locked to `https://case-clicker.com` in both files — update if you ever call this
  from elsewhere.
- No auth on `submit-score` beyond requiring a `userId` + numeric `totalValue` — anyone who
  can read the userscript's source can forge a submission with a fake `userId`/value. Fine
  for a casual/friends leaderboard; add a shared-secret header or signed payload if you want
  it harder to spoof.
- Storage is a single sorted set (`leaderboard:scores`) + one meta hash per user
  (`leaderboard:meta:<userId>`) in Vercel KV (Upstash Redis). Cheap and simple; swap for a
  real database if you outgrow it.
