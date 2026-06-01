import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import "./AdminSettings.css";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const AdminSettings = () => {
  const navigate   = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);

  // Rate-limit state
  const [rlConfig, setRlConfig]   = useState({ max: 500, windowMinutes: 15 });
  const [rlStats, setRlStats]     = useState({ activeIPs: 0, totalHits: 0 });
  const [rlLoading, setRlLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [ipList, setIpList]       = useState([]);
  const [ipLoading, setIpLoading] = useState(false);
  const [unblocking, setUnblocking] = useState(null); // ip being unblocked

  // Editable fields
  const [editMax, setEditMax]         = useState(500);
  const [editWindow, setEditWindow]   = useState(15);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  // Backup & Restore state
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("jwtToken");
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, []);

  const fetchRateLimit = useCallback(async () => {
    setRlLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/rate-limit`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setRlConfig(data.config);
        setRlStats(data.stats);
        setEditMax(data.config.max);
        setEditWindow(data.config.windowMinutes);
      } else {
        toast.error(data.message || "Failed to load rate limit config");
      }
    } catch { toast.error("Cannot reach backend"); }
    finally { setRlLoading(false); }
  }, [authHeaders]);

  const fetchIPs = useCallback(async () => {
    setIpLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/rate-limit/ips`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setIpList(data.ips || []);
    } catch {}
    finally { setIpLoading(false); }
  }, [authHeaders]);

  useEffect(() => { fetchRateLimit(); fetchIPs(); }, [fetchRateLimit, fetchIPs]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/rate-limit`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ max: editMax, windowMinutes: editWindow }),
      });
      const data = await res.json();
      if (data.success) {
        setRlConfig(data.config);
        toast.success("✅ Rate limit config updated!");
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch { toast.error("Failed to update config"); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset rate-limit counters for ALL IPs? This unblocks everyone immediately.")) return;
    setResetting(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/rate-limit/reset`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("🔄 All IP counters cleared!");
        fetchRateLimit();
        fetchIPs();
      } else {
        toast.error(data.message || "Reset failed");
      }
    } catch { toast.error("Failed to reset counters"); }
    finally { setResetting(false); }
  };

  const handleUnblock = async (ip) => {
    setUnblocking(ip);
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/rate-limit/unblock/${encodeURIComponent(ip)}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Unblocked ${ip}`);
        fetchIPs();
      } else {
        toast.error(data.message || "Unblock failed");
      }
    } catch { toast.error("Failed to unblock IP"); }
    finally { setUnblocking(null); }
  };

  const handleWhitelistAdd = async (ipToAdd) => {
    const ip = ipToAdd || whitelistInput;
    if (!ip?.trim()) return;
    setWhitelistLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/rate-limit/whitelist`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ip: ip.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`🛡️ IP ${ip} Whitelisted successfully`);
        setWhitelistInput("");
        fetchRateLimit();
        fetchIPs();
      } else {
        toast.error(data.message || "Failed to whitelist IP");
      }
    } catch {
      toast.error("Network error whitelisting IP");
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleWhitelistRemove = async (ip) => {
    if (!window.confirm(`Remove ${ip} from the whitelist?`)) return;
    setWhitelistLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/rate-limit/whitelist/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`❌ Removed ${ip} from whitelist`);
        fetchRateLimit();
        fetchIPs();
      } else {
        toast.error(data.message || "Failed to remove whitelist");
      }
    } catch {
      toast.error("Network error removing IP from whitelist");
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleBackupExport = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/backup/export`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().split("T")[0];
        a.href = url;
        a.download = `nilexcart_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("🎉 Backup downloaded successfully to your laptop!");
      } else {
        toast.error(data.message || "Failed to generate backup");
      }
    } catch {
      toast.error("Network error exporting backup");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleBackupImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("🚨 WARNING: This will overwrite ALL existing data in the database collections with the backup data. Do you want to proceed?")) {
      e.target.value = "";
      return;
    }

    setRestoreLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupObj = JSON.parse(event.target.result);
        const res = await fetch(`${BASE_URL}/api/admin/backup/import`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(backupObj),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("🎉 Database successfully restored from backup!");
          fetchRateLimit();
          fetchIPs();
        } else {
          toast.error(data.message || "Failed to restore backup");
        }
      } catch (err) {
        toast.error("Invalid JSON backup file or restore failed");
      } finally {
        setRestoreLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (!currentUser) return null;

  const usagePercent = Math.min(100, Math.round((rlStats.totalHits / (rlConfig.max || 1)) * 100));
  const isHealthy = usagePercent < 60;
  const isWarning = usagePercent >= 60 && usagePercent < 85;
  const isDanger  = usagePercent >= 85;

  return (
    <section className="asettings-page">
      <div className="container-fluid px-4 py-4">

        {/* Admin Nav */}
        <div className="admin-nav-tabs mb-4">
          <NavLink to="/admin/users"      className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>👥 Users</NavLink>
          <NavLink to="/admin/products"   className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🛍️ Products</NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🗂️ Categories</NavLink>
          <NavLink to="/admin/bills"      className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🧾 Bills</NavLink>
          <NavLink to="/admin/customers"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>👤 Customers</NavLink>
          <NavLink to="/admin/stock"      className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>📦 Stock</NavLink>
          <NavLink to="/admin/discounts"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🏷️ Discounts</NavLink>
          <NavLink to="/admin/settings"   className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>⚙️ Settings</NavLink>
        </div>

        {/* Page Header */}
        <div className="asettings-header mb-4">
          <div>
            <h2 className="asettings-title">
              ⚙️ Server Settings
              <span className="asettings-underline" />
            </h2>
            <p className="asettings-subtitle">Live control over backend security policies and rate limiting</p>
          </div>
          <button className="asettings-refresh-btn" onClick={fetchRateLimit} disabled={rlLoading}>
            {rlLoading ? "⏳ Refreshing…" : "🔄 Refresh"}
          </button>
        </div>

        {/* ── Rate Limiter Control Panel ── */}
        <div className="rl-panel">

          {/* Panel header with live status badge */}
          <div className="rl-panel-header">
            <div className="rl-panel-title-group">
              <span className="rl-icon">🛡️</span>
              <div>
                <h4 className="rl-panel-title">API Rate Limiter</h4>
                <p className="rl-panel-subtitle">Controls how many requests each IP address can make per time window</p>
              </div>
            </div>
            <div className={`rl-status-badge ${isHealthy ? "status-ok" : isWarning ? "status-warn" : "status-danger"}`}>
              {isHealthy ? "✅ Healthy" : isWarning ? "⚠️ Moderate" : "🚨 High Load"}
            </div>
          </div>

          {/* Live stats cards */}
          <div className="rl-stats-grid">
            <div className="rl-stat-card">
              <span className="rl-stat-icon">🌐</span>
              <div>
                <div className="rl-stat-val">{rlConfig.max}</div>
                <div className="rl-stat-label">Max Requests / Window</div>
              </div>
            </div>
            <div className="rl-stat-card">
              <span className="rl-stat-icon">⏱️</span>
              <div>
                <div className="rl-stat-val">{rlConfig.windowMinutes} min</div>
                <div className="rl-stat-label">Time Window</div>
              </div>
            </div>
            <div className="rl-stat-card">
              <span className="rl-stat-icon">📍</span>
              <div>
                <div className="rl-stat-val">{rlStats.activeIPs}</div>
                <div className="rl-stat-label">Active IPs Tracked</div>
              </div>
            </div>
            <div className="rl-stat-card">
              <span className="rl-stat-icon">📊</span>
              <div>
                <div className="rl-stat-val">{rlStats.totalHits}</div>
                <div className="rl-stat-label">Total Hits This Window</div>
              </div>
            </div>
          </div>

          {/* Usage gauge */}
          <div className="rl-usage-bar-section">
            <div className="rl-usage-label">
              <span>Request Usage</span>
              <span className={isDanger ? "text-danger" : isWarning ? "text-warn" : "text-ok"}>
                {usagePercent}%
              </span>
            </div>
            <div className="rl-usage-track">
              <div
                className={`rl-usage-fill ${isDanger ? "fill-danger" : isWarning ? "fill-warn" : "fill-ok"}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="rl-usage-legend">
              <span>0</span>
              <span>{Math.floor(rlConfig.max * 0.6)} (warning)</span>
              <span>{rlConfig.max} (limit)</span>
            </div>
          </div>

          {/* Config form */}
          <form className="rl-config-form" onSubmit={handleSave}>
            <h5 className="rl-form-title">⚙️ Adjust Limits</h5>
            <div className="rl-form-row">
              <div className="rl-form-group">
                <label>Max Requests per IP</label>
                <div className="rl-input-wrap">
                  <input
                    type="number"
                    id="rl-max-input"
                    className="rl-input"
                    value={editMax}
                    min={10}
                    max={10000}
                    onChange={(e) => setEditMax(parseInt(e.target.value) || 10)}
                  />
                  <span className="rl-input-unit">req</span>
                </div>
                <small>Recommended: 200–1000 for production, 500+ for dev</small>
              </div>

              <div className="rl-form-group">
                <label>Time Window</label>
                <div className="rl-input-wrap">
                  <input
                    type="number"
                    id="rl-window-input"
                    className="rl-input"
                    value={editWindow}
                    min={1}
                    max={60}
                    onChange={(e) => setEditWindow(parseInt(e.target.value) || 1)}
                  />
                  <span className="rl-input-unit">min</span>
                </div>
                <small>Recommended: 15 minutes</small>
              </div>
            </div>

            <div className="rl-form-actions">
              <button
                type="button"
                className="rl-preset-btn"
                onClick={() => { setEditMax(100); setEditWindow(15); }}
                title="Strict: 100 req / 15 min"
              >🔒 Strict</button>
              <button
                type="button"
                className="rl-preset-btn"
                onClick={() => { setEditMax(300); setEditWindow(15); }}
                title="Standard: 300 req / 15 min"
              >⚖️ Standard</button>
              <button
                type="button"
                className="rl-preset-btn"
                onClick={() => { setEditMax(500); setEditWindow(15); }}
                title="Relaxed: 500 req / 15 min"
              >🚀 Relaxed</button>
              <button
                type="button"
                className="rl-preset-btn preset-dev"
                onClick={() => { setEditMax(2000); setEditWindow(15); }}
                title="Dev Mode: 2000 req / 15 min"
              >🛠️ Dev Mode</button>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                id="rl-reset-btn"
                className="rl-reset-btn"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? "⏳ Resetting…" : "🔄 Reset All Counters"}
              </button>
              <button type="submit" id="rl-save-btn" className="rl-save-btn" disabled={saving}>
                {saving ? "⏳ Saving…" : "💾 Apply Changes"}
              </button>
            </div>
          </form>

          {/* Info row */}
          <div className="rl-info-row">
            <div className="rl-info-item">
              <span className="rl-info-icon">ℹ️</span>
              <span><strong>Max</strong> changes take effect on the <em>next request</em> from each IP.</span>
            </div>
            <div className="rl-info-item">
              <span className="rl-info-icon">🔄</span>
              <span><strong>Reset All Counters</strong> immediately unblocks any locked-out IPs.</span>
            </div>
            <div className="rl-info-item">
              <span className="rl-info-icon">⚠️</span>
              <span>Changes are <strong>in-memory only</strong> — restart reverts to 500 req/15 min.</span>
            </div>
          </div>
        </div>

          {/* ── Dynamic Whitelist Input Field ── */}
          <div className="rl-whitelist-form" style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h5 className="rl-form-title">🛡️ Quick Whitelist IP</h5>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="rl-input"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', flex: 1, padding: '10px 14px' }}
                placeholder="Enter IP Address to Whitelist (e.g. 103.208.68.211)"
                value={whitelistInput}
                onChange={(e) => setWhitelistInput(e.target.value)}
              />
              <button
                type="button"
                className="rl-save-btn"
                onClick={() => handleWhitelistAdd()}
                disabled={whitelistLoading}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
              >
                {whitelistLoading ? "Adding..." : "🛡️ Whitelist IP"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Backup & Restore Panel ── */}
        <div className="rl-panel" style={{ marginTop: '1.5rem' }}>
          <div className="rl-panel-header">
            <div className="rl-panel-title-group">
              <span className="rl-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>💾</span>
              <div>
                <h4 className="rl-panel-title">Database Backup & Restore</h4>
                <p className="rl-panel-subtitle">Export database collections to local storage or restore from previous backup</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h5 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>📦 Download Backup</h5>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                Securely fetch all current data collections (Users, Products, Bills, Customers, Categories, and Orders) and compile them into a downloadable JSON file.
              </p>
              <button
                type="button"
                className="rl-save-btn"
                onClick={handleBackupExport}
                disabled={backupLoading}
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)', marginTop: 'auto', alignSelf: 'flex-start' }}
              >
                {backupLoading ? "⏳ Exporting Backup..." : "💾 Download Backup (.json)"}
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '280px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h5 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f87171' }}>🚨 Restore Database</h5>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                Restore your database from an existing `.json` backup file. <strong>Warning:</strong> This will replace all existing documents in whitelisted collections!
              </p>
              
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label
                  className="rl-save-btn"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                    cursor: restoreLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-block',
                    textAlign: 'center',
                    opacity: restoreLoading ? 0.6 : 1
                  }}
                >
                  {restoreLoading ? "⏳ Restoring..." : "📤 Upload & Restore"}
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleBackupImport}
                    disabled={restoreLoading}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Live IP Monitor Table ── */}
        <div className="rl-panel" style={{ marginTop: '1.5rem' }}>
          <div className="rl-panel-header">
            <div className="rl-panel-title-group">
              <span className="rl-icon">🌐</span>
              <div>
                <h4 className="rl-panel-title">Live IP Monitor</h4>
                <p className="rl-panel-subtitle">All IPs tracked this window — whitelisted & blocked ones first</p>
              </div>
            </div>
            <button className="asettings-refresh-btn" onClick={fetchIPs} disabled={ipLoading}>
              {ipLoading ? "⏳" : "🔄 Refresh IPs"}
            </button>
          </div>

          {ipList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              {ipLoading ? "Loading IP data…" : "No active IPs tracked yet in this window."}
            </div>
          ) : (
            <div className="rl-ip-table-wrap">
              <table className="rl-ip-table">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Requests</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Last Route</th>
                    <th>Blocked At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ipList.map((entry) => (
                    <tr key={entry.ip} className={entry.whitelisted ? 'rl-row-whitelisted' : entry.blocked ? 'rl-row-blocked' : ''}>
                      <td>
                        <code className="rl-ip-code" style={{ borderLeft: entry.whitelisted ? '3px solid #10b981' : '' }}>
                          {entry.ip}
                        </code>
                      </td>
                      <td>{entry.whitelisted ? '∞ (Unlimited)' : <span><strong>{entry.requests}</strong> / {entry.limit}</span>}</td>
                      <td>
                        {entry.whitelisted ? (
                          <span style={{ fontSize: '11px', color: '#10b981' }}>🛡️ Whitelisted</span>
                        ) : (
                          <>
                            <div className="rl-mini-bar-track">
                              <div
                                className={`rl-mini-bar-fill ${
                                  entry.percent >= 100 ? 'fill-danger' :
                                  entry.percent >= 60  ? 'fill-warn'   : 'fill-ok'
                                }`}
                                style={{ width: `${entry.percent}%` }}
                              />
                            </div>
                            <span className="rl-mini-pct">{entry.percent}%</span>
                          </>
                        )}
                      </td>
                      <td>
                        {entry.whitelisted ? (
                          <span className="rl-badge-ok" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>🛡️ Whitelisted</span>
                        ) : entry.blocked ? (
                          <span className="rl-badge-blocked">🚫 Blocked</span>
                        ) : entry.percent >= 60 ? (
                          <span className="rl-badge-warn">⚠️ Warning</span>
                        ) : (
                          <span className="rl-badge-ok">✅ Normal</span>
                        )}
                      </td>
                      <td><span className="rl-route">{entry.lastRoute || '—'}</span></td>
                      <td><span className="rl-time">{entry.lastBlocked ? new Date(entry.lastBlocked).toLocaleTimeString() : '—'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {entry.whitelisted ? (
                            <button
                              className="rl-unblock-btn"
                              style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }}
                              onClick={() => handleWhitelistRemove(entry.ip)}
                              disabled={whitelistLoading}
                            >
                              Remove Whitelist
                            </button>
                          ) : (
                            <>
                              <button
                                className="rl-unblock-btn"
                                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}
                                onClick={() => handleWhitelistAdd(entry.ip)}
                                disabled={whitelistLoading}
                              >
                                🛡️ Whitelist
                              </button>
                              {entry.blocked && (
                                <button
                                  className="rl-unblock-btn"
                                  onClick={() => handleUnblock(entry.ip)}
                                  disabled={unblocking === entry.ip}
                                >
                                  {unblocking === entry.ip ? '⏳' : '🔓 Unblock'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


      </div>
    </section>
  );
};

export default AdminSettings;
