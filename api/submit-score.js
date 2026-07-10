// Vercel serverless function: POST /api/submit-score
// Body: { userId: string, username: string, avatarUrl?: string, totalValue: number, nativeValue: number }
//
// Upserts one leaderboard entry per userId, ranked by totalValue, using Vercel KV (Upstash
// Redis under the hood). This is the write side the userscript calls after every "Scan All".
//
// Setup:
//   1. In your Vercel project: Storage tab -> Create Database -> KV. This auto-adds the
//      KV_REST_API_URL / KV_REST_API_TOKEN env vars for you (both Production and Preview).
//   2. npm install @vercel/kv
//   3. Deploy. Then set CONFIG.LEADERBOARD_API_BASE in the userscript to your deployment URL
//      (e.g. https://your-project.vercel.app) — no trailing slash.
//
// Data model: a single Redis sorted set "leaderboard:scores" (member = userId, score =
// totalValue) for ranking, plus a hash "leaderboard:meta:<userId>" holding the display
// fields (username, avatarUrl, nativeValue, updatedAt) so the sorted set itself stays cheap.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // The userscript calls this from case-clicker.com's own origin (it runs in page context,
  // not a privileged extension context), so this is a genuine cross-origin request and needs
  // CORS headers + an OPTIONS preflight response. Locked to case-clicker.com rather than '*'
  // since this endpoint accepts writes.
  res.setHeader('Access-Control-Allow-Origin', 'https://case-clicker.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, username, avatarUrl, totalValue, nativeValue } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (typeof totalValue !== 'number' || !isFinite(totalValue)) {
      return res.status(400).json({ error: 'totalValue must be a finite number' });
    }

    await Promise.all([
      kv.zadd('leaderboard:scores', { score: totalValue, member: userId }),
      kv.hset(`leaderboard:meta:${userId}`, {
        username: typeof username === 'string' && username ? username : 'Unknown',
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
        nativeValue: typeof nativeValue === 'number' && isFinite(nativeValue) ? nativeValue : totalValue,
        updatedAt: new Date().toISOString(),
      }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit-score failed', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
