import express from 'express';
import roleGuard from '../middleware/roleGuard.js';
import {
  rateLimitConfig,
  rateLimitStore,
  blockedIPLog,
  ipRequestTracker,
  resetTrackerIP,
  resetAllTrackerIPs,
  startTrackerResetTimer
} from '../server.js';

const router = express.Router();

// All admin routes require admin role
router.use(roleGuard(['admin']));

// ── GET /api/admin/rate-limit ── current config & live hit stats ──────────
router.get('/rate-limit', async (req, res) => {
  try {
    const activeIPs = Object.keys(ipRequestTracker).length;
    const totalHits = Object.values(ipRequestTracker).reduce((s, v) => s + (v.count || 0), 0);

    res.json({
      success: true,
      config: {
        max: rateLimitConfig.max,
        windowMs: rateLimitConfig.windowMs,
        windowMinutes: Math.round(rateLimitConfig.windowMs / 60000),
        whitelist: rateLimitConfig.whitelist || []
      },
      stats: { activeIPs, totalHits },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/rate-limit/ips ── list all tracked IPs ─────────────────
router.get('/rate-limit/ips', async (req, res) => {
  try {
    const max = rateLimitConfig.max;

    const ipList = Object.entries(ipRequestTracker).map(([ip, val]) => {
      const isWhitelisted = (rateLimitConfig.whitelist || []).includes(ip);
      const count = val.count || 0;
      
      // Determine blocked status (either exceeding requests limit or logged in blocked logs)
      const lastBlock = blockedIPLog
        .filter(e => e.ip === ip)
        .sort((a, b) => new Date(b.time) - new Date(a.time))[0];
      
      const blocked = count >= max || !!lastBlock;

      return {
        ip,
        requests: count,
        limit: max,
        percent: isWhitelisted ? 0 : Math.min(100, Math.round((count / max) * 100)),
        blocked: isWhitelisted ? false : blocked,
        whitelisted: isWhitelisted,
        lastRoute:   val.lastRoute || lastBlock?.route || null,
        lastBlocked: lastBlock?.time  || null,
      };
    });

    // Whitelisted loop to display even if they have 0 requests (keeps them visible in the dashboard UI!)
    (rateLimitConfig.whitelist || []).forEach(wIp => {
      if (!ipList.some(e => e.ip === wIp)) {
        ipList.push({
          ip: wIp,
          requests: 0,
          limit: max,
          percent: 0,
          blocked: false,
          whitelisted: true,
          lastRoute: null,
          lastBlocked: null
        });
      }
    });

    // Sort: whitelisted first, then blocked first, then by request count desc
    ipList.sort((a, b) => (b.whitelisted - a.whitelisted) || (b.blocked - a.blocked) || (b.requests - a.requests));

    res.json({ success: true, ips: ipList, total: ipList.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/rate-limit/unblock/:ip ── unblock a specific IP ───────
router.post('/rate-limit/unblock/:ip', async (req, res) => {
  try {
    const ip = decodeURIComponent(req.params.ip);
    
    // Clear express-rate-limit internal counter
    if (typeof rateLimitStore.resetKey === 'function') {
      await rateLimitStore.resetKey(ip);
    } else if (rateLimitStore.hits) {
      rateLimitStore.hits.delete(ip);
    }
    
    // Clear custom tracker counter
    resetTrackerIP(ip);
    
    // Remove from blockedIPLog too so they don't stay marked as blocked
    const index = blockedIPLog.findIndex(e => e.ip === ip);
    if (index > -1) {
      blockedIPLog.splice(index, 1);
    }

    console.log(`[Admin] Unblocked IP: ${ip}`);
    res.json({ success: true, message: `IP ${ip} has been unblocked` });
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
      // Restart reset interval with new window minutes!
      startTrackerResetTimer();
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
    
    // Reset custom tracker counters
    resetAllTrackerIPs();
    
    // Clear blocked logs
    blockedIPLog.length = 0;

    console.log('[Admin] Rate limit counters reset for all IPs');
    res.json({ success: true, message: 'Rate limit counters reset for all IPs' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/rate-limit/whitelist ── add IP to whitelist ───────────
router.post('/rate-limit/whitelist', async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip?.trim()) {
      return res.status(400).json({ success: false, message: 'ip is required' });
    }

    if (!rateLimitConfig.whitelist) rateLimitConfig.whitelist = [];

    const cleanIp = ip.trim();
    if (!rateLimitConfig.whitelist.includes(cleanIp)) {
      rateLimitConfig.whitelist.push(cleanIp);
      
      // Instantly unblock if they were blocked
      if (typeof rateLimitStore.resetKey === 'function') {
        await rateLimitStore.resetKey(cleanIp);
      }
      resetTrackerIP(cleanIp);
      
      const index = blockedIPLog.findIndex(e => e.ip === cleanIp);
      if (index > -1) blockedIPLog.splice(index, 1);
    }

    console.log(`[Admin] Added IP to whitelist: ${cleanIp}`);
    res.json({
      success: true,
      message: `IP ${cleanIp} added to whitelist`,
      whitelist: rateLimitConfig.whitelist
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/rate-limit/whitelist/:ip ── remove IP from whitelist ──
router.delete('/rate-limit/whitelist/:ip', async (req, res) => {
  try {
    const ip = decodeURIComponent(req.params.ip);
    if (!rateLimitConfig.whitelist) rateLimitConfig.whitelist = [];

    rateLimitConfig.whitelist = rateLimitConfig.whitelist.filter(item => item !== ip);

    console.log(`[Admin] Removed IP from whitelist: ${ip}`);
    res.json({
      success: true,
      message: `IP ${ip} removed from whitelist`,
      whitelist: rateLimitConfig.whitelist
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

