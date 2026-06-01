import express from 'express';
import mongoose from 'mongoose';
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

// ── GET /api/admin/backup/export ── Export all database collections ──────────
router.get('/backup/export', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.collections();
    const backupData = {};
    
    for (const col of collections) {
      const name = col.collectionName;
      if (name.startsWith('system.')) continue;
      const docs = await col.find({}).toArray();
      backupData[name] = docs;
    }

    console.log(`[Backup] Successful database export requested by Admin`);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      dbName: mongoose.connection.name,
      collections: backupData
    });
  } catch (err) {
    console.error(`[Backup] Export failed:`, err);
    res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
  }
});

// ── POST /api/admin/backup/import ── Import database collections from backup ──
router.post('/backup/import', async (req, res) => {
  try {
    const { collections } = req.body;
    if (!collections || typeof collections !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid backup format. "collections" object is required.' });
    }

    const db = mongoose.connection.db;

    // Helper function to restore dates and ObjectIds from JSON representation
    const restoreBSON = (val, key = '') => {
      if (val === null || val === undefined) return val;
      if (typeof val === 'string') {
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
        if (isoDateRegex.test(val)) {
          return new Date(val);
        }
        const isHex24 = /^[0-9a-fA-F]{24}$/.test(val);
        const isIdKey = key === '_id' || /id$/i.test(key);
        if (isHex24 && isIdKey) {
          try {
            return new mongoose.Types.ObjectId(val);
          } catch (e) {
            return val;
          }
        }
        return val;
      }
      if (Array.isArray(val)) {
        return val.map(item => restoreBSON(item, key));
      }
      if (typeof val === 'object') {
        const res = {};
        for (const k in val) {
          res[k] = restoreBSON(val[k], k);
        }
        return res;
      }
      return val;
    };

    const results = {};

    for (const [colName, docs] of Object.entries(collections)) {
      if (colName.startsWith('system.')) continue;
      if (!Array.isArray(docs)) continue;

      const col = db.collection(colName);
      
      // Delete existing documents in the collection
      await col.deleteMany({});

      if (docs.length > 0) {
        // Restore ObjectId and Date fields
        const parsedDocs = docs.map(d => restoreBSON(d));
        await col.insertMany(parsedDocs);
      }

      results[colName] = { deleted: docs.length, inserted: docs.length };
    }

    console.log(`[Backup] Successful database restore completed by Admin`);
    res.json({
      success: true,
      message: 'Database restored successfully!',
      results
    });
  } catch (err) {
    console.error(`[Backup] Restore failed:`, err);
    res.status(500).json({ success: false, message: 'Restore failed: ' + err.message });
  }
});

export default router;

