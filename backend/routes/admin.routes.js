import express from 'express';
import roleGuard from '../middleware/roleGuard.js';
import { rateLimitConfig, rateLimitStore } from '../server.js';

const router = express.Router();

// All admin routes require admin role
router.use(roleGuard(['admin']));

// ── GET /api/admin/rate-limit ── current config & live hit stats ──────────
router.get('/rate-limit', async (req, res) => {
  try {
    // MemoryStore exposes getAll() to read hit counts per key (IP)
    let hits = {};
    try {
      // express-rate-limit v6+ MemoryStore has .getAll() via internal map
      if (rateLimitStore.hits) {
        hits = Object.fromEntries(rateLimitStore.hits);
      }
    } catch (_) { /* ignore if not accessible */ }

    const activeIPs = Object.keys(hits).length;
    const totalHits = Object.values(hits).reduce((s, v) => s + (v.totalHits || v || 0), 0);

    res.json({
      success: true,
      config: {
        max: rateLimitConfig.max,
        windowMs: rateLimitConfig.windowMs,
        windowMinutes: Math.round(rateLimitConfig.windowMs / 60000),
      },
      stats: {
        activeIPs,
        totalHits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/rate-limit ── update max and/or windowMs ─────────────
router.patch('/rate-limit', async (req, res) => {
  try {
    const { max, windowMinutes } = req.body;

    if (max !== undefined) {
      const parsed = parseInt(max);
      if (isNaN(parsed) || parsed < 10 || parsed > 10000) {
        return res.status(400).json({ success: false, message: 'max must be between 10 and 10000' });
      }
      rateLimitConfig.max = parsed;
    }

    if (windowMinutes !== undefined) {
      const parsed = parseInt(windowMinutes);
      if (isNaN(parsed) || parsed < 1 || parsed > 60) {
        return res.status(400).json({ success: false, message: 'windowMinutes must be between 1 and 60' });
      }
      rateLimitConfig.windowMs = parsed * 60 * 1000;
    }

    console.log(`[Admin] Rate limit updated → max: ${rateLimitConfig.max}, window: ${rateLimitConfig.windowMs / 60000}min`);

    res.json({
      success: true,
      message: 'Rate limit config updated',
      config: {
        max: rateLimitConfig.max,
        windowMs: rateLimitConfig.windowMs,
        windowMinutes: Math.round(rateLimitConfig.windowMs / 60000),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/rate-limit/reset ── clear all IP counters ────────────
router.post('/rate-limit/reset', async (req, res) => {
  try {
    if (typeof rateLimitStore.resetAll === 'function') {
      await rateLimitStore.resetAll();
    } else if (rateLimitStore.hits) {
      rateLimitStore.hits.clear();
    }

    console.log('[Admin] Rate limit counters reset for all IPs');

    res.json({
      success: true,
      message: 'Rate limit counters reset for all IPs',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
