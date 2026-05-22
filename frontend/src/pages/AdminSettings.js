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

  // Editable fields
  const [editMax, setEditMax]         = useState(500);
  const [editWindow, setEditWindow]   = useState(15);

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

  useEffect(() => { fetchRateLimit(); }, [fetchRateLimit]);

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
      } else {
        toast.error(data.message || "Reset failed");
      }
    } catch { toast.error("Failed to reset counters"); }
    finally { setResetting(false); }
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

      </div>
    </section>
  );
};

export default AdminSettings;
