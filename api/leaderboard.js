// Vercel serverless function: GET /api/leaderboard?limit=50
// Response: { entries: [{ rank, userId, username, avatarUrl, totalValue, nativeValue, updatedAt }] }
//
// Read side for the userscript's "Pricedata Value" category on /leaderboard. Reads the
// sorted set written by submit-score.js, highest totalValue first, and joins in the display
// fields from each user's meta hash.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://case-clicker.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    // zrange with rev: true + withScores gives [member, score, member, score, ...] highest first
    const raw = await kv.zrange('leaderboard:scores', 0, limit - 1, { rev: true, withScores: true });

    const userIds = [];
    const scoreByUser = {};
    for (let i = 0; i < raw.length; i += 2) {
      const userId = raw[i];
      const score = Number(raw[i + 1]);
      userIds.push(userId);
      scoreByUser[userId] = score;
    }

    const metas = await Promise.all(userIds.map(id => kv.hgetall(`leaderboard:meta:${id}`)));

    const entries = userIds.map((userId, i) => {
      const meta = metas[i] || {};
      return {
        rank: i + 1,
        userId,
        username: meta.username || 'Unknown',
        avatarUrl: meta.avatarUrl || null,
        totalValue: scoreByUser[userId],
        nativeValue: meta.nativeValue != null ? Number(meta.nativeValue) : scoreByUser[userId],
        updatedAt: meta.updatedAt || null,
      };
    });

    return res.status(200).json({ entries });
  } catch (err) {
    console.error('leaderboard fetch failed', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
