import { useEffect, useState, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import {
  fetchBills, createBillThunk, updateBillThunk,
  deleteBillThunk, authorizeCashThunk, clearBillMessages,
} from "../app/billSlice";
import { fetchCustomers, createCustomerThunk, clearCustomerMessages } from "../app/customerSlice";
import "./AdminBills.css";

const EMPTY_FORM = {
  customerName:  "",
  customerEmail: "",
  customerPhone: "",
  txnId:         "",
  amount:        "",
  txnType:       "receive",
  paymentMethod: "online",
  status:        "paid",
  receivedBy:    "",
  notes:         "",
  txnDate:       new Date().toISOString().slice(0, 16),
};

const METHOD_ICONS = { online: "💳", cash: "💵", upi: "📱", card: "🏧" };

const initials = (name) =>
  name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const AdminBills = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { bills, totalRevenue, loading, error, successMsg } = useSelector((s) => s.bills);
  const { currentUser } = useSelector((s) => s.users);
  const { customers, error: custError, successMsg: custSuccess } = useSelector((s) => s.customers);

  const [search,            setSearch]            = useState("");
  const [methodFilter,      setMethodFilter]      = useState("all");
  const [statusFilter,      setStatusFilter]      = useState("all");
  const [showForm,          setShowForm]          = useState(false);
  const [editTarget,        setEditTarget]        = useState(null);
  const [form,              setForm]              = useState(EMPTY_FORM);
  const [receiptFile,       setReceiptFile]       = useState(null);
  const [receiptPrev,       setReceiptPrev]       = useState(null);
  const [deleteTarget,      setDeleteTarget]      = useState(null);
  const [lightbox,          setLightbox]          = useState(null);
  // ── Customer picker state ──────────────────────────
  const [selectedCustId,    setSelectedCustId]    = useState("");
  const [custSearch,        setCustSearch]        = useState("");
  const [showCustDropdown,  setShowCustDropdown]  = useState(false);
  // ── Quick Customer Add state ──────────────────────────
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({ name: "", mobile: "", email: "", address: "", notes: "" });
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  // ── Camera state ───────────────────────────────────
  const [showCamera,        setShowCamera]        = useState(false);
  const [camStream,         setCamStream]         = useState(null);
  const [camFacing,         setCamFacing]         = useState("environment"); // 'environment'=rear, 'user'=front
  const [camError,          setCamError]          = useState("");
  const fileRef    = useRef();
  const custRef    = useRef();
  const videoRef   = useRef();
  const canvasRef  = useRef();

  // Redirect non-admins
  useEffect(() => { if (!currentUser) navigate("/"); }, [currentUser, navigate]);
  useEffect(() => { dispatch(fetchBills()); dispatch(fetchCustomers()); }, [dispatch]);

  useEffect(() => {
    if (successMsg) { toast.success(successMsg); dispatch(clearBillMessages()); }
    if (error)      { toast.error(error);        dispatch(clearBillMessages()); }
  }, [successMsg, error, dispatch]);

  useEffect(() => {
    if (custSuccess) { toast.success(custSuccess); dispatch(clearCustomerMessages()); }
    if (custError)   { toast.error(custError);     dispatch(clearCustomerMessages()); }
  }, [custSuccess, custError, dispatch]);

  // ── Close customer dropdown when clicking outside ──
  useEffect(() => {
    const handler = (e) => {
      if (custRef.current && !custRef.current.contains(e.target)) {
        setShowCustDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived filtered list ──────────────────────────
  const filtered = bills.filter((b) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      b.customerName?.toLowerCase().includes(q) ||
      b.customerEmail?.toLowerCase().includes(q) ||
      b.txnId?.toLowerCase().includes(q) ||
      b.receivedBy?.toLowerCase().includes(q);
    const matchM = methodFilter === "all" || b.paymentMethod === methodFilter;
    const matchS = statusFilter === "all" || b.status === statusFilter;
    return matchQ && matchM && matchS;
  });

  // ── Stats ──────────────────────────────────────────
  const cashCount       = bills.filter((b) => b.paymentMethod === "cash").length;
  const onlineCount     = bills.filter((b) => b.paymentMethod !== "cash").length;
  const pendingCount    = bills.filter((b) => b.status === "pending").length;
  const authorizedCount = bills.filter((b) => b.cashAuthorized).length;

  // ── Customer picker helpers ────────────────────────
  const filteredCusts = customers.filter((c) => {
    const q = custSearch.toLowerCase();
    return (
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const selectCustomer = (c) => {
    setSelectedCustId(c._id);
    setCustSearch(c.name);
    setShowCustDropdown(false);
    setForm((prev) => ({
      ...prev,
      customerName:  c.name   || "",
      customerEmail: c.email  || "",
      customerPhone: c.mobile || "",
    }));
  };

  const clearCustSelection = () => {
    setSelectedCustId("");
    setCustSearch("");
    setForm((prev) => ({ ...prev, customerName: "", customerEmail: "", customerPhone: "" }));
  };

  const handleQuickAddCustomer = async (e) => {
    if (e) e.preventDefault();
    if (!quickCust.name || !quickCust.mobile) {
      toast.error("Name and mobile number are required");
      return;
    }
    try {
      const resultAction = await dispatch(createCustomerThunk(quickCust));
      if (createCustomerThunk.fulfilled.match(resultAction)) {
        const newCust = resultAction.payload;
        selectCustomer(newCust);
        setShowQuickAddCustomer(false);
        setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
      } else {
        toast.error(resultAction.payload || "Failed to create customer");
      }
    } catch (err) {
      toast.error("Error creating customer");
    }
  };

  const handleHeaderAddCustomer = async (e) => {
    if (e) e.preventDefault();
    if (!quickCust.name || !quickCust.mobile) {
      toast.error("Name and mobile number are required");
      return;
    }
    try {
      const resultAction = await dispatch(createCustomerThunk(quickCust));
      if (createCustomerThunk.fulfilled.match(resultAction)) {
        setShowQuickCustModal(false);
        setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
      } else {
        toast.error(resultAction.payload || "Failed to create customer");
      }
    } catch (err) {
      toast.error("Error creating customer");
    }
  };

  // ── Camera helpers ─────────────────────────────────
  const stopCamera = useCallback(() => {
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      setCamStream(null);
    }
    setShowCamera(false);
    setCamError("");
  }, [camStream]);

  const startCamera = useCallback(async (facing = camFacing) => {
    setCamError("");
    // Stop any existing stream first
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCamStream(stream);
      setCamFacing(facing);
      setShowCamera(true);
      // Attach stream to video element after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 80);
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : err.name === "NotFoundError"
        ? "No camera found on this device."
        : `Camera error: ${err.message}`;
      setCamError(msg);
      toast.error(msg);
    }
  }, [camStream, camFacing]);

  const snapPhoto = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
      setReceiptFile(file);
      setReceiptPrev(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.92);
  }, [stopCamera]);

  const switchFacing = useCallback(() => {
    const next = camFacing === "environment" ? "user" : "environment";
    startCamera(next);
  }, [camFacing, startCamera]);

  // Stop camera when modal closes
  useEffect(() => {
    if (!showForm && camStream) stopCamera();
  }, [showForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────
  const openCreate = () => {
    const defaultReceiver = currentUser?.name 
      ? `${currentUser.name} (${currentUser.email})`
      : currentUser?.email || "";

    setForm({ 
      ...EMPTY_FORM, 
      txnDate: new Date().toISOString().slice(0, 16),
      receivedBy: defaultReceiver
    });
    setEditTarget(null);
    setReceiptFile(null);
    setReceiptPrev(null);
    setSelectedCustId("");
    setCustSearch("");
    setShowQuickAddCustomer(false);
    setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (b) => {
    // Try to find matching customer by phone
    const matched = customers.find((c) => c.mobile === b.customerPhone);
    setSelectedCustId(matched?._id || "");
    setCustSearch(b.customerName || "");
    setForm({
      customerName:  b.customerName  || "",
      customerEmail: b.customerEmail || "",
      customerPhone: b.customerPhone || "",
      txnId:         b.txnId         || "",
      amount:        b.amount        || "",
      txnType:       b.txnType       || "receive",
      paymentMethod: b.paymentMethod || "online",
      status:        b.status        || "paid",
      receivedBy:    b.receivedBy    || "",
      notes:         b.notes         || "",
      txnDate:       b.txnDate ? new Date(b.txnDate).toISOString().slice(0, 16) : "",
    });
    setReceiptFile(null);
    setReceiptPrev(b.receiptUrl || null);
    setEditTarget(b);
    setShowQuickAddCustomer(false);
    setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
    setShowForm(true);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setReceiptFile(f);
    setReceiptPrev(URL.createObjectURL(f));
  };

  const buildFormData = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (receiptFile) fd.append("receipt", receiptFile);
    return fd;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.amount) {
      toast.error("Customer name and amount are required");
      return;
    }
    if (!form.customerPhone && !form.customerEmail) {
      toast.error("Please provide customer mobile or email");
      return;
    }
    const fd = buildFormData();
    if (editTarget) {
      dispatch(updateBillThunk({ id: editTarget._id, formData: fd }));
    } else {
      dispatch(createBillThunk(fd));
    }
    setShowForm(false);
    setEditTarget(null);
    setSelectedCustId("");
    setCustSearch("");
  };

  const handleAuthorize = (bill) => {
    const doAuth = !bill.cashAuthorized;
    dispatch(authorizeCashThunk({
      id: bill._id,
      authorize: doAuth,
      authorizedBy: currentUser?.name || currentUser?.email || "Admin",
    }));
  };

  const handleDelete = () => {
    if (deleteTarget) dispatch(deleteBillThunk(deleteTarget._id));
    setDeleteTarget(null);
  };

  return (
    <section className="bills-page">

      {/* ── Tab Navigation ──────────────────────────── */}
      <div className="admin-nav-tabs">
        <NavLink to="/admin/users"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          👥 Users
        </NavLink>
        <NavLink to="/admin/products"    className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🛍️ Products
        </NavLink>
        <NavLink to="/admin/categories"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🗂️ Categories
        </NavLink>
        <NavLink to="/admin/bills"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🧾 Bills
          <span className="tab-badge">{bills.length}</span>
        </NavLink>
        <NavLink to="/admin/customers"   className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          👤 Customers
        </NavLink>
        <NavLink to="/admin/stock"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          📦 Stock
        </NavLink>
        <NavLink to="/admin/deliveries"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🚚 Deliveries
        </NavLink>
      </div>

      <div className="container-fluid px-4 py-4">

        {/* ── Page header ─────────────────────────────── */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h2 style={{ fontWeight: 800, color: "#0f3460", margin: 0 }}>Bill &amp; Transaction Manager</h2>
            <p style={{ color: "#888", margin: "4px 0 0", fontSize: 14 }}>
              {bills.length} transactions · ₹{totalRevenue?.toLocaleString("en-IN") || "0"} total revenue
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="bills-add-btn" style={{ background: "#5c6bc0" }} onClick={() => {
              setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
              setShowQuickCustModal(true);
            }}>
              + Add Customer
            </button>
            <button className="bills-add-btn" onClick={openCreate}>
              + Record Transaction
            </button>
          </div>
        </div>

        {/* ── Stats cards ─────────────────────────────── */}
        <div className="bills-stats">
          <div className="bstat">
            <div className="bstat-icon green">💰</div>
            <div>
              <div className="bstat-num">₹{totalRevenue?.toLocaleString("en-IN") || "0"}</div>
              <div className="bstat-lbl">Total Revenue</div>
            </div>
          </div>
          <div className="bstat">
            <div className="bstat-icon blue">🧾</div>
            <div>
              <div className="bstat-num">{bills.length}</div>
              <div className="bstat-lbl">Total Transactions</div>
            </div>
          </div>
          <div className="bstat">
            <div className="bstat-icon yellow">💵</div>
            <div>
              <div className="bstat-num">{cashCount}</div>
              <div className="bstat-lbl">Cash Payments</div>
            </div>
          </div>
          <div className="bstat">
            <div className="bstat-icon purple">💳</div>
            <div>
              <div className="bstat-num">{onlineCount}</div>
              <div className="bstat-lbl">Online Payments</div>
            </div>
          </div>
          <div className="bstat">
            <div className="bstat-icon red">⏳</div>
            <div>
              <div className="bstat-num">{pendingCount}</div>
              <div className="bstat-lbl">Pending</div>
            </div>
          </div>
          <div className="bstat">
            <div className="bstat-icon green">✅</div>
            <div>
              <div className="bstat-num">{authorizedCount}</div>
              <div className="bstat-lbl">Cash Authorized</div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────── */}
        <div className="bills-toolbar">
          <input
            className="bills-search"
            placeholder="🔍  Search by customer, email, txn ID, receiver…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="bills-filter-pills">
            {["all", "online", "cash", "upi", "card"].map((m) => (
              <button
                key={m}
                className={`bpill ${methodFilter === m ? "active" : ""}`}
                onClick={() => setMethodFilter(m)}
              >
                {m === "all" ? "All" : `${METHOD_ICONS[m]} ${m.charAt(0).toUpperCase() + m.slice(1)}`}
              </button>
            ))}
          </div>
          <div className="bills-filter-pills">
            {["all", "paid", "authorized", "pending", "cancelled"].map((s) => (
              <button
                key={s}
                className={`bpill ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
                style={{ fontSize: 11 }}
              >
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ───────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#0f3460" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bills-empty">
            <div className="bills-empty-icon">🧾</div>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="bills-table-wrap">
            <table className="bills-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Txn ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Received By</th>
                  <th>Txn Date</th>
                  <th>Receipt</th>
                  <th>Cash Auth</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b._id}>

                    {/* Customer */}
                    <td>
                      <div className="cust-cell">
                        <div className="cust-avatar">{initials(b.customerName)}</div>
                        <div>
                          <div className="cust-name">{b.customerName}</div>
                          <div className="cust-email">{b.customerEmail}</div>
                          {b.customerPhone && (
                            <div className="cust-email">📞 {b.customerPhone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Txn ID */}
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#666" }}>
                        {b.txnId || <span style={{ color: "#ccc" }}>—</span>}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="bill-amount">
                      {b.txnType === 'give' ? (
                        <div style={{ fontWeight: "bold", color: "#d9534f" }}>- ₹{Number(b.amount).toLocaleString("en-IN")}</div>
                      ) : (
                        <div style={{ fontWeight: "bold", color: "#28a745" }}>+ ₹{Number(b.amount).toLocaleString("en-IN")}</div>
                      )}
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {b.txnType === 'give' ? "Due / Given" : "Received"}
                      </div>
                    </td>

                    {/* Method */}
                    <td>
                      <span className={`pay-badge ${b.paymentMethod}`}>
                        {METHOD_ICONS[b.paymentMethod]} {b.paymentMethod}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-badge ${b.status}`}>
                        {b.status?.charAt(0).toUpperCase() + b.status?.slice(1)}
                      </span>
                    </td>

                    {/* Received By */}
                    <td style={{ fontSize: 13 }}>
                      {b.receivedBy || <span style={{ color: "#ccc" }}>—</span>}
                    </td>

                    {/* Txn Date */}
                    <td style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                      {fmt(b.txnDate)}
                    </td>

                    {/* Receipt */}
                    <td>
                      {b.receiptUrl ? (
                        <img
                          src={b.receiptUrl}
                          alt="receipt"
                          className="receipt-thumb"
                          onClick={() => setLightbox(b.receiptUrl)}
                          title="Click to enlarge"
                        />
                      ) : (
                        <div className="receipt-placeholder">📄</div>
                      )}
                    </td>

                    {/* Cash Authorize */}
                    <td>
                      {b.paymentMethod === "cash" || b.status === "pending" ? (
                        <div>
                          <button
                            className={`auth-btn ${b.cashAuthorized ? "revoke" : "authorize"}`}
                            onClick={() => handleAuthorize(b)}
                            disabled={loading}
                          >
                            {b.cashAuthorized ? "✕ Revoke" : "✔ Authorize"}
                          </button>
                          {b.cashAuthorized && b.cashAuthorizedBy && (
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                              by {b.cashAuthorizedBy}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#ccc" }}>N/A</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="d-flex gap-2">
                        <button className="bill-edit-btn" onClick={() => openEdit(b)}>Edit</button>
                        <button className="bill-del-btn"  onClick={() => setDeleteTarget(b)}>Del</button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────── */}
      {showForm && (
        <div className="bills-backdrop" onClick={() => setShowForm(false)}>
          <div className="bills-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bills-modal-close" onClick={() => setShowForm(false)}>×</button>
            <h5>{editTarget ? "✏️ Edit Transaction" : "🧾 Record New Transaction"}</h5>

            <form onSubmit={handleSubmit}>
              <div className="bill-form-grid">

                {/* ── Customer Picker or Quick Add Customer ── */}
                {showQuickAddCustomer ? (
                  <div className="bill-form-full quick-add-cust-box" style={{ background: "#f8f9fa", padding: "16px", borderRadius: "12px", border: "1px dashed #0f3460", marginBottom: "10px" }}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 style={{ color: "#0f3460", fontWeight: "bold", margin: 0 }}>👤 Quick Add New Customer</h6>
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '12px' }}
                        onClick={() => setShowQuickAddCustomer(false)}
                        aria-label="Close"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="bill-form-label">Full Name *</label>
                        <input 
                          className="bill-form-input" 
                          value={quickCust.name}
                          onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                          placeholder="e.g. Rajesh Kumar" 
                        />
                      </div>
                      <div>
                        <label className="bill-form-label">Mobile Number *</label>
                        <input 
                          className="bill-form-input" 
                          value={quickCust.mobile}
                          onChange={(e) => setQuickCust({ ...quickCust, mobile: e.target.value })}
                          placeholder="+91 98765 43210" 
                        />
                      </div>
                      <div className="bill-form-full">
                        <label className="bill-form-label">Email (optional)</label>
                        <input 
                          type="email" 
                          className="bill-form-input" 
                          value={quickCust.email}
                          onChange={(e) => setQuickCust({ ...quickCust, email: e.target.value })}
                          placeholder="customer@example.com" 
                        />
                      </div>
                      <div className="bill-form-full">
                        <label className="bill-form-label">Address (optional)</label>
                        <input 
                          className="bill-form-input" 
                          value={quickCust.address}
                          onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                          placeholder="Street, City" 
                        />
                      </div>
                      <div className="bill-form-full">
                        <label className="bill-form-label">Notes (optional)</label>
                        <textarea 
                          className="bill-form-textarea" 
                          value={quickCust.notes}
                          onChange={(e) => setQuickCust({ ...quickCust, notes: e.target.value })}
                          placeholder="Customer notes..." 
                          rows="2"
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3 justify-content-end">
                      <button 
                        type="button" 
                        className="btn btn-sm" 
                        style={{ background: "#0f3460", color: "#fff", fontWeight: "bold" }}
                        onClick={handleQuickAddCustomer}
                      >
                        Save &amp; Select
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setShowQuickAddCustomer(false);
                          setQuickCust({ name: "", mobile: "", email: "", address: "", notes: "" });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ── Customer Picker ── */}
                    <div className="bill-form-full">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label className="bill-form-label mb-0">Select Customer</label>
                        {!editTarget && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-decoration-none"
                            style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f3460' }}
                            onClick={() => setShowQuickAddCustomer(true)}
                          >
                            ➕ Quick Add Customer
                          </button>
                        )}
                      </div>
                      <div className="cust-picker-wrap" ref={custRef}>
                        <div className="cust-picker-input-row">
                          <span className="cust-picker-icon">👤</span>
                          <input
                            className="cust-picker-input"
                            placeholder="Search by name, mobile or email…"
                            value={custSearch}
                            onChange={(e) => {
                              setCustSearch(e.target.value);
                              setShowCustDropdown(true);
                              if (!e.target.value) clearCustSelection();
                            }}
                            onFocus={() => setShowCustDropdown(true)}
                            autoComplete="off"
                          />
                          {selectedCustId && (
                            <button type="button" className="cust-picker-clear" onClick={clearCustSelection} title="Clear selection">×</button>
                          )}
                        </div>

                        {/* Dropdown list */}
                        {showCustDropdown && (
                          <div className="cust-picker-dropdown">
                            {filteredCusts.length === 0 ? (
                              <div className="cust-picker-empty">No customers found</div>
                            ) : (
                              filteredCusts.map((c) => (
                                <div
                                  key={c._id}
                                  className={`cust-picker-option ${selectedCustId === c._id ? "selected" : ""}`}
                                  onMouseDown={() => selectCustomer(c)}
                                >
                                  <div className="cust-picker-opt-avatar">
                                    {c.name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                                  </div>
                                  <div className="cust-picker-opt-info">
                                    <div className="cust-picker-opt-name">{c.name}</div>
                                    <div className="cust-picker-opt-sub">📞 {c.mobile}{c.email ? ` · ${c.email}` : ""}</div>
                                  </div>
                                  {selectedCustId === c._id && <span className="cust-picker-check">✓</span>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected customer badge */}
                      {selectedCustId && (
                        <div className="cust-selected-badge">
                          ✅ Customer auto-filled from profile
                        </div>
                      )}
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="bill-form-label">Customer Name *</label>
                      <input className="bill-form-input" value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        placeholder="Full name" />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="bill-form-label">Mobile Number</label>
                      <input className="bill-form-input" value={form.customerPhone}
                        onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                        placeholder="+91 98765 43210" />
                    </div>

                    {/* Customer Email */}
                    <div className="bill-form-full">
                      <label className="bill-form-label">Customer Email</label>
                      <input type="email" className="bill-form-input" value={form.customerEmail}
                        onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                        placeholder="customer@example.com (optional if mobile provided)" />
                    </div>
                  </>
                )}

                {/* Txn ID */}
                <div>
                  <label className="bill-form-label">Transaction / Reference ID</label>
                  <input className="bill-form-input" value={form.txnId}
                    onChange={(e) => setForm({ ...form, txnId: e.target.value })}
                    placeholder="razorpay_xxx / manual ref" />
                </div>

                {/* Transaction Type */}
                <div className="bill-form-full">
                  <label className="bill-form-label">Transaction Type</label>
                  <div className="d-flex gap-3 mt-1">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500, color: '#28a745' }}>
                      <input 
                        type="radio" 
                        name="txnType" 
                        value="receive" 
                        checked={form.txnType === 'receive'} 
                        onChange={(e) => setForm({ ...form, txnType: e.target.value })} 
                      />
                      ➕ Receive Payment (In)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500, color: '#d9534f' }}>
                      <input 
                        type="radio" 
                        name="txnType" 
                        value="give" 
                        checked={form.txnType === 'give'} 
                        onChange={(e) => setForm({ ...form, txnType: e.target.value })} 
                      />
                      ➖ Give Payment / Due (Out)
                    </label>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="bill-form-label">Amount (₹) *</label>
                  <input type="number" min="0" className="bill-form-input" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0" />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="bill-form-label">Payment Method</label>
                  <select className="bill-form-select" value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                    <option value="online">💳 Online (Razorpay)</option>
                    <option value="cash">💵 Cash (In-Store)</option>
                    <option value="upi">📱 UPI</option>
                    <option value="card">🏧 Card</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="bill-form-label">Status</label>
                  <select className="bill-form-select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="paid">✅ Paid</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="authorized">🔵 Authorized (Cash)</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>

                {/* Received By */}
                <div>
                  <label className="bill-form-label">Received By (Staff Name)</label>
                  <input className="bill-form-input" value={form.receivedBy}
                    onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
                    placeholder="Staff / admin name" />
                </div>

                {/* Txn Date */}
                <div className="bill-form-full">
                  <label className="bill-form-label">Transaction Date &amp; Time</label>
                  <input type="datetime-local" className="bill-form-input" value={form.txnDate}
                    onChange={(e) => setForm({ ...form, txnDate: e.target.value })} />
                </div>

                {/* Notes */}
                <div className="bill-form-full">
                  <label className="bill-form-label">Notes</label>
                  <textarea className="bill-form-textarea" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any additional notes about this transaction…" />
                </div>

                {/* ── Receipt / Camera Capture ── */}
                <div className="bill-form-full">
                  <label className="bill-form-label">Receipt / Txn Snapshot</label>

                  {/* ── Live Camera Widget ── */}
                  {showCamera ? (
                    <div className="cam-widget">
                      <video ref={videoRef} className="cam-video" autoPlay playsInline muted />
                      <canvas ref={canvasRef} style={{ display: "none" }} />
                      <div className="cam-controls">
                        <button type="button" className="cam-snap-btn" onClick={snapPhoto}>
                          📷 Capture
                        </button>
                        <button type="button" className="cam-switch-btn" onClick={switchFacing} title="Switch camera">
                          🔄
                        </button>
                        <button type="button" className="cam-cancel-btn" onClick={stopCamera}>
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ) : receiptPrev ? (
                    /* ── Captured / Uploaded Preview ── */
                    <div className="cam-preview-wrap">
                      <img src={receiptPrev} alt="receipt preview" className="cam-preview-img" />
                      <div className="cam-preview-actions">
                        <button type="button" className="cam-retake-btn" onClick={() => startCamera()}>
                          📷 Retake
                        </button>
                        <button type="button" className="cam-remove-btn"
                          onClick={() => { setReceiptFile(null); setReceiptPrev(null); }}>
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Empty state — choose mode ── */
                    <div className="cam-empty">
                      {camError && <div className="cam-error">{camError}</div>}
                      <button type="button" className="cam-open-btn" onClick={() => startCamera()}>
                        📷 Open Camera
                      </button>
                      <span className="cam-or">or</span>
                      <button type="button" className="cam-gallery-btn" onClick={() => fileRef.current?.click()}>
                        🖼️ Choose from Gallery
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </div>
                  )}
                </div>

              </div>

              <button type="submit" className="bills-submit-btn" disabled={loading}>
                {loading ? "Saving…" : editTarget ? "Update Transaction" : "Record Transaction"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────── */}
      {deleteTarget && (
        <div className="bills-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="bills-modal bills-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h5>🗑️ Delete Transaction?</h5>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
              Transaction for <strong>{deleteTarget.customerName}</strong> (₹{Number(deleteTarget.amount).toLocaleString("en-IN")})
              will be permanently deleted.
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

      {/* ── Receipt lightbox ─────────────────────────── */}
      {lightbox && (
        <div className="receipt-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Receipt" />
        </div>
      )}

      {/* ── Quick Add Customer Modal (from Header) ──────────────────────── */}
      {showQuickCustModal && (
        <div className="bills-backdrop" onClick={() => setShowQuickCustModal(false)}>
          <div className="bills-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bills-modal-close" onClick={() => setShowQuickCustModal(false)}>×</button>
            <h5>👤 Add Customer Profile</h5>

            <form onSubmit={handleHeaderAddCustomer}>
              <div className="bill-form-grid">
                <div>
                  <label className="bill-form-label">Full Name *</label>
                  <input className="bill-form-input" value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar" required />
                </div>

                <div>
                  <label className="bill-form-label">Mobile Number *</label>
                  <input className="bill-form-input" value={quickCust.mobile}
                    onChange={(e) => setQuickCust({ ...quickCust, mobile: e.target.value })}
                    placeholder="+91 98765 43210" required />
                </div>

                <div className="bill-form-full">
                  <label className="bill-form-label">Email (optional)</label>
                  <input type="email" className="bill-form-input" value={quickCust.email}
                    onChange={(e) => setQuickCust({ ...quickCust, email: e.target.value })}
                    placeholder="customer@example.com" />
                </div>

                <div className="bill-form-full">
                  <label className="bill-form-label">Address (optional)</label>
                  <input className="bill-form-input" value={quickCust.address}
                    onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                    placeholder="Street, City" />
                </div>

                <div className="bill-form-full">
                  <label className="bill-form-label">Notes (optional)</label>
                  <textarea className="bill-form-textarea" value={quickCust.notes}
                    onChange={(e) => setQuickCust({ ...quickCust, notes: e.target.value })}
                    placeholder="Any notes about this customer…" />
                </div>
              </div>

              <button type="submit" className="bills-submit-btn" disabled={loading}>
                {loading ? "Saving…" : "Add Customer"}
              </button>
            </form>
          </div>
        </div>
      )}

    </section>
  );
};

export default AdminBills;
