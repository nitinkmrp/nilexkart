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
  paymentMethod: "cash",
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
  // ── Invoice Creator state ─────────────────────────────
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    gstRate: 0,
    otherCharges: 0,
    notes: "",
    txnDate: new Date().toISOString().slice(0, 16),
    paymentMethod: "cash",
    status: "paid",
    txnType: "receive",
  });
  const [invoiceItems, setInvoiceItems] = useState([
    { description: "", qty: 1, rate: 0 }
  ]);
  const [printData, setPrintData] = useState(null);
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

  const generateInvoiceNumber = () => {
    let maxNum = 0;
    let foundAny = false;
    if (bills && bills.length > 0) {
      bills.forEach((b) => {
        if (b.txnId && b.txnId.startsWith("UGR")) {
          const numPart = b.txnId.slice(3); // get numeric part after "UGR"
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed)) {
            if (!foundAny || parsed > maxNum) {
              maxNum = parsed;
              foundAny = true;
            }
          }
        }
      });
    }
    const nextNum = foundAny ? maxNum + 1 : 1000;
    const padded = String(nextNum).padStart(4, "0");
    return `UGR${padded}`;
  };

  const openInvoiceModal = () => {
    setInvoiceForm({
      invoiceNumber: generateInvoiceNumber(),
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      gstRate: 0,
      otherCharges: 0,
      notes: "Make all checks payable to USHA DEVI\nTotal due in 15 days.",
      txnDate: new Date().toISOString().slice(0, 16),
      paymentMethod: "cash",
      status: "paid",
      txnType: "receive",
    });
    setInvoiceItems([{ description: "", qty: 1, rate: 0 }]);
    setSelectedCustId("");
    setCustSearch("");
    setShowInvoiceModal(true);
  };

  const selectCustomerForInvoice = (c) => {
    setSelectedCustId(c._id);
    setCustSearch(c.name);
    setShowCustDropdown(false);
    setInvoiceForm((prev) => ({
      ...prev,
      customerName:  c.name   || "",
      customerEmail: c.email  || "",
      customerPhone: c.mobile || "",
    }));
  };

  const addInvoiceItemRow = () => {
    setInvoiceItems([...invoiceItems, { description: "", qty: 1, rate: 0 }]);
  };

  const removeInvoiceItemRow = (index) => {
    const updated = [...invoiceItems];
    updated.splice(index, 1);
    setInvoiceItems(updated);
  };

  const handleInvoiceItemChange = (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = value;
    setInvoiceItems(updated);
  };

  const invoiceSubtotal = invoiceItems.reduce((acc, item) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    return acc + (qty * rate);
  }, 0);

  const invoiceGstAmount = (invoiceSubtotal * (parseFloat(invoiceForm.gstRate) || 0)) / 100;
  const invoiceTotal = invoiceSubtotal + invoiceGstAmount + (parseFloat(invoiceForm.otherCharges) || 0);

  const handleSaveInvoice = async (shouldPrint = false) => {
    if (!invoiceForm.customerName || !invoiceTotal) {
      toast.error("Customer name and items are required");
      return;
    }
    if (!invoiceForm.customerPhone && !invoiceForm.customerEmail) {
      toast.error("Please provide customer mobile or email");
      return;
    }

    const items = invoiceItems.map(item => ({
      name: item.description || "Uncategorized Item",
      qty: Number(item.qty),
      price: Number(item.rate),
    }));

    const fd = new FormData();
    fd.append("customerName", invoiceForm.customerName);
    fd.append("customerEmail", invoiceForm.customerEmail || "");
    fd.append("customerPhone", invoiceForm.customerPhone || "");
    fd.append("txnId", invoiceForm.invoiceNumber);
    fd.append("amount", invoiceTotal.toFixed(2));
    fd.append("txnType", invoiceForm.txnType || "receive");
    fd.append("paymentMethod", invoiceForm.paymentMethod);
    fd.append("status", invoiceForm.status);
    fd.append("receivedBy", currentUser?.name || currentUser?.email || "Admin");
    fd.append("notes", invoiceForm.notes || "");
    fd.append("txnDate", invoiceForm.txnDate);
    fd.append("items", JSON.stringify(items));

    try {
      const resultAction = await dispatch(createBillThunk(fd));
      if (createBillThunk.fulfilled.match(resultAction)) {
        toast.success("Invoice recorded successfully!");
        setShowInvoiceModal(false);

        if (shouldPrint) {
          setPrintData({
            invoiceNumber: invoiceForm.invoiceNumber,
            customerName: invoiceForm.customerName,
            customerEmail: invoiceForm.customerEmail,
            customerPhone: invoiceForm.customerPhone,
            gstRate: invoiceForm.gstRate,
            otherCharges: invoiceForm.otherCharges,
            notes: invoiceForm.notes,
            txnDate: invoiceForm.txnDate,
            items: items,
            subtotal: invoiceSubtotal,
            gstAmount: invoiceGstAmount,
            total: invoiceTotal,
          });
          setTimeout(() => {
            window.print();
          }, 500);
        }
      } else {
        toast.error(resultAction.payload || "Failed to record invoice");
      }
    } catch (err) {
      toast.error("Error recording invoice");
    }
  };

  const printExistingBill = (b) => {
    const items = (b.items && b.items.length > 0)
      ? b.items.map(it => ({ description: it.name || it.description, qty: it.qty, rate: it.price || it.rate }))
      : [{ description: b.notes || "Transaction Amount", qty: 1, rate: b.amount }];

    const subtotal = items.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

    setPrintData({
      invoiceNumber: b.txnId || `INV-${b._id?.slice(-6).toUpperCase() || "NEW"}`,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      gstRate: 0,
      otherCharges: 0,
      notes: b.notes,
      txnDate: b.txnDate,
      items: items,
      subtotal: subtotal,
      gstAmount: 0,
      total: b.amount,
    });
    setTimeout(() => {
      window.print();
    }, 500);
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
            <button className="bills-add-btn" style={{ background: "#2ecc71" }} onClick={openInvoiceModal}>
              + Create Invoice
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
                        <button className="bill-edit-btn" style={{ background: "#e8f8f0", color: "#2d9a56" }} onClick={() => printExistingBill(b)}>Print</button>
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
                    <option value="cash">💵 Cash (In-Store)</option>
                    <option value="upi">📱 UPI</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="bill-form-label">Status</label>
                  <select className="bill-form-select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="paid">✅ Paid</option>
                    <option value="pending">⏳ Pending</option>
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

      {/* ── Printable Invoice (hidden on screen, visible on print) ── */}
      {printData && (
        <div className="print-only-invoice">
          <div className="invoice-print-header">
            <h1 className="company-title">USHA GARMENTS</h1>
            <h2 className="invoice-title">INVOICE</h2>
          </div>

          <div className="invoice-meta-row">
            <div>
              <p><strong>PAN</strong> - CXCPD3605B &nbsp;&nbsp;&nbsp;&nbsp; <strong>GSTN</strong> - 09CXCPD3605B1Z4</p>
              <p>KASERU CHAURAHA RAMPUR NISFI</p>
              <p>RAMPUR MARIAHU JAUNPUR U.P 222203</p>
              <p><strong>MOB</strong> - 7007592343</p>
            </div>
            <div className="text-end">
              <h3>INVOICE# {printData.invoiceNumber}</h3>
            </div>
          </div>

          <hr className="invoice-divider" />

          <div className="invoice-bill-to-row">
            <div>
              <h4 className="bill-to-title">BILL TO:</h4>
              <p className="customer-name"><strong>{printData.customerName}</strong></p>
              {printData.customerPhone && <p>📞 {printData.customerPhone}</p>}
              {printData.customerEmail && <p>✉️ {printData.customerEmail}</p>}
            </div>
            <div className="text-end">
              <p><strong>DATE:</strong> {new Date(printData.txnDate).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          <table className="invoice-print-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th className="text-center">QUANTITY</th>
                <th className="text-end">RATE</th>
                <th className="text-end">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.description || item.name || "—"}</td>
                  <td className="text-center">{Number(item.qty).toFixed(2)}</td>
                  <td className="text-end">Rs{Number(item.rate || item.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="text-end">Rs{Number((item.qty || 0) * (item.rate || item.price || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-summary-section">
            <div className="invoice-notes-block">
              {printData.notes && (
                <>
                  <p><strong>Notes:</strong></p>
                  <p>{printData.notes}</p>
                </>
              )}
            </div>
            <div className="invoice-totals-block">
              <table className="totals-table">
                <tbody>
                  <tr>
                    <td><strong>SUBTOTAL</strong></td>
                    <td className="text-end">Rs{Number(printData.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  {Number(printData.gstRate) > 0 && (
                    <>
                      <tr>
                        <td><strong>GST RATE</strong></td>
                        <td className="text-end">{Number(printData.gstRate).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td><strong>TOTAL GST</strong></td>
                        <td className="text-end">Rs{Number(printData.gstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </>
                  )}
                  {Number(printData.otherCharges) > 0 && (
                    <tr>
                      <td><strong>OTHER</strong></td>
                      <td className="text-end">Rs{Number(printData.otherCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="grand-total-row">
                    <td><strong>TOTAL</strong></td>
                    <td className="text-end"><strong>Rs{Number(printData.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-print-footer">
            <p>Make all checks payable to <strong>USHA DEVI</strong></p>
            <p>Total due in 15 days. Overdue accounts subject to a service charge of 1% per month.</p>
            <h4 className="thank-you-msg">THANK YOU FOR YOUR BUSINESS!</h4>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ──────────────────────── */}
      {showInvoiceModal && (
        <div className="bills-backdrop" onClick={() => setShowInvoiceModal(false)}>
          <div className="bills-modal" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <button className="bills-modal-close" onClick={() => setShowInvoiceModal(false)}>×</button>
            <h5 className="mb-3">📄 Create Invoice</h5>

            <div className="bill-form-grid">
              {/* Invoice Number & Date */}
              <div>
                <label className="bill-form-label">Invoice Number</label>
                <input 
                  className="bill-form-input" 
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="e.g. UGR0568" 
                />
              </div>
              <div>
                <label className="bill-form-label">Date &amp; Time</label>
                <input 
                  type="datetime-local" 
                  className="bill-form-input" 
                  value={invoiceForm.txnDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, txnDate: e.target.value })} 
                />
              </div>

              {/* Customer Selection Row */}
              <div className="bill-form-full">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="bill-form-label mb-0">Select Customer Profile</label>
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
                        if (!e.target.value) {
                          setSelectedCustId("");
                          setInvoiceForm(prev => ({ ...prev, customerName: "", customerEmail: "", customerPhone: "" }));
                        }
                      }}
                      onFocus={() => setShowCustDropdown(true)}
                      autoComplete="off"
                    />
                    {selectedCustId && (
                      <button type="button" className="cust-picker-clear" onClick={() => {
                        setSelectedCustId("");
                        setCustSearch("");
                        setInvoiceForm(prev => ({ ...prev, customerName: "", customerEmail: "", customerPhone: "" }));
                      }} title="Clear selection">×</button>
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
                            onMouseDown={() => selectCustomerForInvoice(c)}
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
              </div>

              {/* Customer Manual Details */}
              <div>
                <label className="bill-form-label">Customer Name *</label>
                <input 
                  className="bill-form-input" 
                  value={invoiceForm.customerName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })}
                  placeholder="Full name" 
                />
              </div>
              <div>
                <label className="bill-form-label">Mobile Number</label>
                <input 
                  className="bill-form-input" 
                  value={invoiceForm.customerPhone}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })}
                  placeholder="+91 98765 43210" 
                />
              </div>
              <div className="bill-form-full">
                <label className="bill-form-label">Customer Email</label>
                <input 
                  type="email" 
                  className="bill-form-input" 
                  value={invoiceForm.customerEmail}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerEmail: e.target.value })}
                  placeholder="customer@example.com" 
                />
              </div>

              {/* Itemized Columns */}
              <div className="bill-form-full mt-3">
                <label className="bill-form-label">Items / Product Description</label>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle" style={{ minWidth: "600px", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", fontWeight: "bold" }}>
                        <th style={{ width: "45%" }}>DESCRIPTION</th>
                        <th style={{ width: "15%" }} className="text-center">QUANTITY</th>
                        <th style={{ width: "20%" }} className="text-end">RATE (₹)</th>
                        <th style={{ width: "20%" }} className="text-end">AMOUNT (₹)</th>
                        <th style={{ width: "10%" }} className="text-center">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <input 
                              className="form-control form-control-sm"
                              value={item.description}
                              onChange={(e) => handleInvoiceItemChange(idx, "description", e.target.value)}
                              placeholder="straight line checking"
                              style={{ fontSize: "13px", padding: "6px" }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              min="0.01"
                              step="any"
                              className="form-control form-control-sm text-center"
                              value={item.qty}
                              onChange={(e) => handleInvoiceItemChange(idx, "qty", e.target.value)}
                              placeholder="10.00"
                              style={{ fontSize: "13px", padding: "6px" }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              min="0"
                              step="any"
                              className="form-control form-control-sm text-end"
                              value={item.rate}
                              onChange={(e) => handleInvoiceItemChange(idx, "rate", e.target.value)}
                              placeholder="100.00"
                              style={{ fontSize: "13px", padding: "6px" }}
                            />
                          </td>
                          <td className="text-end font-weight-bold" style={{ verticalAlign: "middle" }}>
                            ₹{Number((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-center">
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-danger" 
                              onClick={() => removeInvoiceItemRow(idx)}
                              disabled={invoiceItems.length <= 1}
                              style={{ padding: "2px 8px", fontSize: "12px" }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button 
                  type="button" 
                  className="btn btn-sm btn-secondary mt-1" 
                  onClick={addInvoiceItemRow}
                  style={{ fontWeight: "600", fontSize: "12px", background: "#533483", border: "none" }}
                >
                  ➕ Add More Item Column
                </button>
              </div>

              {/* Summary calculations */}
              <div className="bill-form-full mt-3 p-3" style={{ background: "#f8f9fa", borderRadius: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <div className="mb-2">
                      <label className="bill-form-label">GST Rate (%)</label>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        className="bill-form-input"
                        value={invoiceForm.gstRate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, gstRate: e.target.value })}
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <label className="bill-form-label">Other / Delivery Charges (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        className="bill-form-input"
                        value={invoiceForm.otherCharges}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, otherCharges: e.target.value })}
                        placeholder="0.00" 
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-column justify-content-end align-items-end text-end" style={{ fontSize: "14px" }}>
                    <div className="mb-1">SUBTOTAL: <strong>₹{invoiceSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                    {invoiceGstAmount > 0 && <div className="mb-1">GST ({invoiceForm.gstRate}%): <strong>₹{invoiceGstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>}
                    {parseFloat(invoiceForm.otherCharges) > 0 && <div className="mb-1">OTHER CHARGES: <strong>₹{parseFloat(invoiceForm.otherCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>}
                    <div className="mt-2 pt-2 border-top" style={{ fontSize: "18px", color: "#0f3460" }}>
                      TOTAL DUE: <strong>₹{invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              <div>
                <label className="bill-form-label">Payment Method</label>
                <select className="bill-form-select" value={invoiceForm.paymentMethod}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}>
                  <option value="cash">💵 Cash (In-Store)</option>
                  <option value="upi">📱 UPI</option>
                </select>
              </div>
              <div>
                <label className="bill-form-label">Payment Status</label>
                <select className="bill-form-select" value={invoiceForm.status}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}>
                  <option value="paid">✅ Paid</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>
              <div>
                <label className="bill-form-label">Payment Type (In / Out)</label>
                <select className="bill-form-select" value={invoiceForm.txnType}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, txnType: e.target.value })}>
                  <option value="receive">➕ In (Receive Payment)</option>
                  <option value="give">➖ Out (Give Payment / Due)</option>
                </select>
              </div>
              <div className="bill-form-full">
                <label className="bill-form-label">Invoice Notes</label>
                <textarea className="bill-form-textarea" value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  placeholder="Make all checks payable to USHA DEVI..." />
              </div>
            </div>

            <div className="d-flex gap-3 mt-4">
              <button 
                type="button" 
                className="bills-submit-btn" 
                style={{ background: "#0f3460" }} 
                onClick={() => handleSaveInvoice(false)}
                disabled={loading}
              >
                Save Invoice
              </button>
              <button 
                type="button" 
                className="bills-submit-btn" 
                style={{ background: "linear-gradient(135deg, #2ecc71, #27ae60)" }} 
                onClick={() => handleSaveInvoice(true)}
                disabled={loading}
              >
                💾 Save &amp; Print Invoice
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
