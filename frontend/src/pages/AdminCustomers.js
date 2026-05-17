import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import {
  fetchCustomers,
  fetchCustomerTimeline,
  createCustomerThunk,
  updateCustomerThunk,
  deleteCustomerThunk,
  clearCustomerMessages,
  clearTimeline,
} from "../app/customerSlice";
import "./AdminCustomers.css";

const EMPTY_FORM = { name: "", mobile: "", email: "", address: "", notes: "" };

const initials = (name) =>
  name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

const METHOD_ICONS = { online: "💳", cash: "💵", upi: "📱", card: "🏧" };
const STATUS_COLOR = {
  paid: { bg: "#d1fae5", color: "#065f46" },
  authorized: { bg: "#dbeafe", color: "#1d4ed8" },
  pending: { bg: "#fef9c3", color: "#92400e" },
  cancelled: { bg: "#fee2e2", color: "#991b1b" },
};

const AdminCustomers = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { customers, timeline, loading, tlLoading, error, successMsg } =
    useSelector((s) => s.customers);
  const { currentUser } = useSelector((s) => s.users);

  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => { if (!currentUser) navigate("/"); }, [currentUser, navigate]);
  useEffect(() => { dispatch(fetchCustomers()); }, [dispatch]);

  useEffect(() => {
    if (successMsg) { toast.success(successMsg); dispatch(clearCustomerMessages()); }
    if (error)      { toast.error(error);        dispatch(clearCustomerMessages()); }
  }, [successMsg, error, dispatch]);

  // ── Search debounce ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => dispatch(fetchCustomers(search)), 350);
    return () => clearTimeout(t);
  }, [search, dispatch]);

  // ── Helpers ──────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({
      name:    c.name    || "",
      mobile:  c.mobile  || "",
      email:   c.email   || "",
      address: c.address || "",
      notes:   c.notes   || "",
    });
    setEditTarget(c);
    setShowForm(true);
  };

  const openTimeline = (c) => {
    dispatch(fetchCustomerTimeline(c._id));
    setShowTimeline(true);
  };

  const closeTimeline = () => {
    setShowTimeline(false);
    dispatch(clearTimeline());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.mobile) {
      toast.error("Name and mobile number are required");
      return;
    }
    if (editTarget) {
      dispatch(updateCustomerThunk({ id: editTarget._id, payload: form }));
    } else {
      dispatch(createCustomerThunk(form));
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleDelete = () => {
    if (deleteTarget) dispatch(deleteCustomerThunk(deleteTarget._id));
    setDeleteTarget(null);
  };

  // ── Stats ────────────────────────────────────────────
  const totalCustomers = customers.length;
  const totalSpend     = customers.reduce((s, c) => s + (c.totalSpend || 0), 0);
  const activeCusts    = customers.filter((c) => (c.txnCount || 0) > 0).length;

  return (
    <section className="cust-page">

      {/* ── Tab Navigation ─────────────────────────────── */}
      <div className="admin-nav-tabs">
        <NavLink to="/admin/users"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>👥 Users</NavLink>
        <NavLink to="/admin/products"    className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🛍️ Products</NavLink>
        <NavLink to="/admin/categories"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🗂️ Categories</NavLink>
        <NavLink to="/admin/bills"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🧾 Bills</NavLink>
        <NavLink to="/admin/customers"   className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          👤 Customers
          <span className="tab-badge">{customers.length}</span>
        </NavLink>
      </div>

      <div className="container-fluid px-4 py-4">

        {/* ── Page Header ──────────────────────────────── */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="cust-page-title">Customer Profiles</h2>
            <p className="cust-page-sub">{totalCustomers} customers · ₹{totalSpend.toLocaleString("en-IN")} total spend</p>
          </div>
          <button className="cust-add-btn" onClick={openCreate}>
            + Add Customer
          </button>
        </div>

        {/* ── Stats ────────────────────────────────────── */}
        <div className="cust-stats">
          <div className="cust-stat">
            <div className="cust-stat-icon blue">👤</div>
            <div>
              <div className="cust-stat-num">{totalCustomers}</div>
              <div className="cust-stat-lbl">Total Customers</div>
            </div>
          </div>
          <div className="cust-stat">
            <div className="cust-stat-icon green">💰</div>
            <div>
              <div className="cust-stat-num">₹{totalSpend.toLocaleString("en-IN")}</div>
              <div className="cust-stat-lbl">Total Revenue</div>
            </div>
          </div>
          <div className="cust-stat">
            <div className="cust-stat-icon purple">🧾</div>
            <div>
              <div className="cust-stat-num">{activeCusts}</div>
              <div className="cust-stat-lbl">Active Buyers</div>
            </div>
          </div>
          <div className="cust-stat">
            <div className="cust-stat-icon yellow">📊</div>
            <div>
              <div className="cust-stat-num">
                {totalCustomers ? Math.round(totalSpend / totalCustomers).toLocaleString("en-IN") : 0}
              </div>
              <div className="cust-stat-lbl">Avg. Spend (₹)</div>
            </div>
          </div>
        </div>

        {/* ── Search ───────────────────────────────────── */}
        <div className="cust-toolbar">
          <input
            className="cust-search"
            placeholder="🔍  Search by name, mobile or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── Customer Cards Grid ───────────────────────── */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#0f3460" }} />
          </div>
        ) : customers.length === 0 ? (
          <div className="cust-empty">
            <div className="cust-empty-icon">👤</div>
            <p>No customers yet. Add your first customer profile!</p>
          </div>
        ) : (
          <div className="cust-grid">
            {customers.map((c) => (
              <div className="cust-card" key={c._id}>
                {/* Avatar + Name */}
                <div className="cust-card-header">
                  <div className="cust-card-avatar">{initials(c.name)}</div>
                  <div className="cust-card-info">
                    <div className="cust-card-name">{c.name}</div>
                    <div className="cust-card-mobile">📞 {c.mobile}</div>
                    {c.email && <div className="cust-card-email">✉️ {c.email}</div>}
                  </div>
                </div>

                {/* Stats bar */}
                <div className="cust-card-stats">
                  <div className="cust-mini-stat">
                    <span className="cust-mini-val">₹{(c.totalSpend || 0).toLocaleString("en-IN")}</span>
                    <span className="cust-mini-lbl">Total Spend</span>
                  </div>
                  <div className="cust-mini-stat">
                    <span className="cust-mini-val">{c.txnCount || 0}</span>
                    <span className="cust-mini-lbl">Transactions</span>
                  </div>
                  <div className="cust-mini-stat">
                    <span className="cust-mini-val">{c.lastTxnDate ? fmtDate(c.lastTxnDate) : "—"}</span>
                    <span className="cust-mini-lbl">Last Purchase</span>
                  </div>
                </div>

                {c.address && (
                  <div className="cust-card-address">📍 {c.address}</div>
                )}
                {c.notes && (
                  <div className="cust-card-notes">💬 {c.notes}</div>
                )}

                {/* Actions */}
                <div className="cust-card-actions">
                  <button className="cust-timeline-btn" onClick={() => openTimeline(c)}>
                    📅 View Timeline
                  </button>
                  <button className="cust-edit-btn" onClick={() => openEdit(c)}>✏️ Edit</button>
                  <button className="cust-del-btn"  onClick={() => setDeleteTarget(c)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────── */}
      {showForm && (
        <div className="cust-backdrop" onClick={() => setShowForm(false)}>
          <div className="cust-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cust-modal-close" onClick={() => setShowForm(false)}>×</button>
            <h5>{editTarget ? "✏️ Edit Customer" : "👤 Add Customer Profile"}</h5>

            <form onSubmit={handleSubmit}>
              <div className="cust-form-grid">

                <div>
                  <label className="cust-form-label">Full Name *</label>
                  <input className="cust-form-input" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar" />
                </div>

                <div>
                  <label className="cust-form-label">Mobile Number *</label>
                  <input className="cust-form-input" value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="+91 98765 43210" />
                </div>

                <div>
                  <label className="cust-form-label">Email (optional)</label>
                  <input type="email" className="cust-form-input" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="customer@example.com" />
                </div>

                <div>
                  <label className="cust-form-label">Address (optional)</label>
                  <input className="cust-form-input" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street, City" />
                </div>

                <div className="cust-form-full">
                  <label className="cust-form-label">Notes</label>
                  <textarea className="cust-form-textarea" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any notes about this customer…" />
                </div>

              </div>

              <button type="submit" className="cust-submit-btn" disabled={loading}>
                {loading ? "Saving…" : editTarget ? "Update Customer" : "Add Customer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────── */}
      {deleteTarget && (
        <div className="cust-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="cust-modal cust-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h5>🗑️ Delete Customer?</h5>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
              Profile for <strong>{deleteTarget.name}</strong> will be permanently removed.
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction Timeline Drawer ───────────────── */}
      {showTimeline && (
        <div className="tl-backdrop" onClick={closeTimeline}>
          <div className="tl-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="tl-close" onClick={closeTimeline}>×</button>

            {tlLoading || !timeline ? (
              <div className="tl-loading">
                <div className="spinner-border" style={{ color: "#0f3460" }} />
                <p>Loading timeline…</p>
              </div>
            ) : (
              <>
                {/* Customer Header */}
                <div className="tl-header">
                  <div className="tl-avatar">{initials(timeline.customer?.name)}</div>
                  <div>
                    <div className="tl-cust-name">{timeline.customer?.name}</div>
                    <div className="tl-cust-sub">📞 {timeline.customer?.mobile}</div>
                    {timeline.customer?.email && (
                      <div className="tl-cust-sub">✉️ {timeline.customer?.email}</div>
                    )}
                  </div>
                  <div className="tl-summary-chips">
                    <div className="tl-chip green">
                      ₹{(timeline.totalSpend || 0).toLocaleString("en-IN")} <span>Spent</span>
                    </div>
                    <div className="tl-chip blue">
                      {timeline.bills?.length || 0} <span>Txns</span>
                    </div>
                  </div>
                </div>

                <h6 className="tl-section-title">Transaction History</h6>

                {/* Timeline */}
                {!timeline.bills || timeline.bills.length === 0 ? (
                  <div className="tl-empty">
                    <span>📭</span>
                    <p>No transactions linked to this customer yet.<br />
                      Make sure the mobile number matches bills.</p>
                  </div>
                ) : (
                  <div className="tl-list">
                    {timeline.bills.map((b, idx) => (
                      <div className="tl-item" key={b._id}>
                        {/* Timeline dot + line */}
                        <div className="tl-dot-col">
                          <div className={`tl-dot tl-dot-${b.status}`} />
                          {idx < timeline.bills.length - 1 && <div className="tl-line" />}
                        </div>

                        {/* Card */}
                        <div className="tl-card">
                          <div className="tl-card-top">
                            <div>
                              <div className="tl-card-amount">₹{Number(b.amount).toLocaleString("en-IN")}</div>
                              <div className="tl-card-date">{fmt(b.txnDate)}</div>
                            </div>
                            <div className="tl-badges">
                              <span className={`tl-method-badge ${b.paymentMethod}`}>
                                {METHOD_ICONS[b.paymentMethod]} {b.paymentMethod}
                              </span>
                              <span
                                className="tl-status-badge"
                                style={{
                                  background: STATUS_COLOR[b.status]?.bg || "#f3f3f3",
                                  color:      STATUS_COLOR[b.status]?.color || "#666",
                                }}
                              >
                                {b.status?.charAt(0).toUpperCase() + b.status?.slice(1)}
                              </span>
                            </div>
                          </div>

                          {b.txnId && (
                            <div className="tl-txnid">Ref: {b.txnId}</div>
                          )}
                          {b.receivedBy && (
                            <div className="tl-received">Received by: {b.receivedBy}</div>
                          )}
                          {b.items && b.items.length > 0 && (
                            <div className="tl-items">
                              {b.items.map((it, i) => (
                                <span key={i} className="tl-item-chip">
                                  {it.name} × {it.qty}
                                  {it.price ? ` — ₹${it.price}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {b.notes && (
                            <div className="tl-notes">💬 {b.notes}</div>
                          )}
                          {b.receiptUrl && (
                            <a href={b.receiptUrl} target="_blank" rel="noreferrer" className="tl-receipt-link">
                              📄 View Receipt
                            </a>
                          )}
                          {b.cashAuthorized && (
                            <div className="tl-authorized">
                              ✅ Cash authorized by {b.cashAuthorizedBy}
                              {b.cashAuthorizedAt ? ` on ${fmtDate(b.cashAuthorizedAt)}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </section>
  );
};

export default AdminCustomers;
