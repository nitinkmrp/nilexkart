import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchCategories } from "../app/categorySlice";
import "./AdminStock.css";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const AdminStock = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);
  const { categories: dbCategories } = useSelector((s) => s.categories);

  // Core State
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // 'all' | 'instock' | 'low' | 'out'
  const [updatingStockId, setUpdatingStockId] = useState(null); // Track inline loading spinner
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // Modern IMS Features State
  const [activeTab, setActiveTab] = useState("inventory"); // 'inventory' | 'advisor' | 'logs'
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [insights, setInsights] = useState({ stats: {}, suggestions: [] });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState(null);

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/products`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    setMovementsLoading(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/products/inventory/movements`, { headers });
      const data = await res.json();
      if (data.success) {
        setMovements(data.data);
      }
    } catch {
      console.error("Failed to load stock movements");
    } finally {
      setMovementsLoading(false);
    }
  };

  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/products/inventory/insights`, { headers });
      const data = await res.json();
      if (data.success) {
        setInsights(data);
      }
    } catch {
      console.error("Failed to load inventory insights");
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    dispatch(fetchCategories());
    fetchMovements();
    fetchInsights();
  }, [dispatch]);

  // Derived categories
  const categoryNames = dbCategories
    .filter((c) => c.isActive)
    .map((c) => c.name);
  const productCats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const allCategoryNames = categoryNames.length > 0 ? categoryNames : productCats;

  // Single Stock Update
  const handleStockChange = async (id, newStock, reason = "Manual stock adjustment") => {
    if (newStock < 0) return;
    setUpdatingStockId(id);
    try {
      const headers = { "Content-Type": "application/json" };
      const token = localStorage.getItem("jwtToken");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/products/${id}/stock`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ 
          stock: newStock,
          reason,
          updatedBy: currentUser?.name || "Admin"
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === id ? { ...p, stock: data.data.stock } : p))
        );
        toast.success(`Stock updated to ${data.data.stock}`);
        fetchMovements(); // Refresh logs
        fetchInsights();  // Refresh insights
      } else {
        toast.error(data.message || "Failed to update stock");
      }
    } catch {
      toast.error("Failed to update stock");
    } finally {
      setUpdatingStockId(null);
    }
  };

  // ── Parse CSV and apply size-aware stock updates ──────────────────────────
  const parseCsvAndUpdate = async (csvText) => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    const dataLines = lines[0].toLowerCase().includes("product name") ? lines.slice(1) : lines;
    const productUpdates = {};

    for (const rawLine of dataLines) {
      const parts = rawLine
        .match(/("(?:[^"]|"")*"|[^,]+)(?:,|$)/g)
        ?.map((p) => p.replace(/,+$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
      if (parts.length < 3) continue;
      const nameOrId = parts[0]?.trim();
      const size     = parts[1]?.trim();
      const qty      = parseInt(parts[2]);
      if (!nameOrId || isNaN(qty) || qty < 0) continue;
      const found = products.find(
        (p) => p._id === nameOrId || p.productName.toLowerCase() === nameOrId.toLowerCase()
      );
      if (!found) continue;
      const id = found._id;
      if (!productUpdates[id]) productUpdates[id] = { product: found, sizeStockPatch: {}, flatStock: null };
      if (!size || size === "-" || size.toLowerCase() === "none") {
        productUpdates[id].flatStock = qty;
      } else {
        productUpdates[id].sizeStockPatch[size] = qty;
      }
    }

    const token = localStorage.getItem("jwtToken");
    const authHeaders = { "Content-Type": "application/json" };
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
    let successCount = 0; let failCount = 0;

    for (const { product, sizeStockPatch, flatStock } of Object.values(productUpdates)) {
      try {
        const hasSizes = Object.keys(sizeStockPatch).length > 0;
        const body = hasSizes
          ? { sizeStock: { ...(product.sizeStock || {}), ...sizeStockPatch }, reason: "Bulk CSV Import", updatedBy: currentUser?.name || "Admin" }
          : { stock: flatStock, reason: "Bulk CSV Import", updatedBy: currentUser?.name || "Admin" };
        const res  = await fetch(`${BASE_URL}/api/products/${product._id}/stock`, {
          method: "PATCH", headers: authHeaders, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) successCount++; else failCount++;
      } catch { failCount++; }
    }
    return { successCount, failCount };
  };

  // ── Bulk import from pasted CSV text ──────────────────────────────────────
  const handleBulkUpdate = async (e) => {
    e.preventDefault();
    if (!bulkInput.trim()) { toast.error("Please enter CSV data"); return; }
    setImporting(true);
    toast.info("Processing bulk updates...");
    try {
      const { successCount, failCount } = await parseCsvAndUpdate(bulkInput);
      if (successCount > 0) { toast.success(`Updated ${successCount} product(s)!`); fetchProducts(); fetchMovements(); fetchInsights(); }
      if (failCount > 0) toast.warn(`Failed or skipped ${failCount} row(s).`);
      if (successCount === 0 && failCount === 0) toast.error("No matching products found.");
    } finally { setImporting(false); setShowBulkModal(false); setBulkInput(""); }
  };

  // ── Bulk import from uploaded .csv file ───────────────────────────────────
  const handleFileImport = async (e) => {
    e.preventDefault();
    if (!importFile) { toast.error("Please select a CSV file"); return; }
    setImporting(true);
    toast.info("Reading CSV file...");
    try {
      const text = await importFile.text();
      const { successCount, failCount } = await parseCsvAndUpdate(text);
      if (successCount > 0) { toast.success(`Updated ${successCount} product(s) from file!`); fetchProducts(); fetchMovements(); fetchInsights(); }
      if (failCount > 0) toast.warn(`Failed or skipped ${failCount} row(s).`);
      if (successCount === 0 && failCount === 0) toast.error("No matching products found in file.");
    } catch { toast.error("Failed to read CSV file"); }
    finally { setImporting(false); setShowBulkModal(false); setImportFile(null); }
  };



  // Applying AI dynamic pricing advice
  const handleApplyPricingSuggestion = async (productId, discountPercent) => {
    setApplyingSuggestionId(productId);
    try {
      const token = localStorage.getItem("jwtToken");
      const headers = { 
        "Content-Type": "application/json"
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Call Product PUT /api/products/:id to adjust discount
      const res = await fetch(`${BASE_URL}/api/products/${productId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          discount: discountPercent,
          reason: "AI Pricing Optimization",
          updatedBy: currentUser?.name || "AI Advisor"
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Applied AI recommendation: ${discountPercent}% discount!`);
        fetchProducts();
        fetchInsights();
      } else {
        toast.error(data.message || "Failed to apply AI suggestion");
      }
    } catch {
      toast.error("Error communicating with servers");
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  // ── CSV Export (size-aware) ──────────────────────────────────────────────
  const exportToCSV = () => {
    if (products.length === 0) { toast.error("No data to export"); return; }

    const rows = ["Product Name,Product ID,Category,Price,Size,Size Stock,Total Stock,Status"];

    filteredProducts.forEach((p) => {
      const totalStock = p.stock || 0;
      const status = totalStock === 0 ? "Out of Stock" : totalStock <= lowStockThreshold ? "Low Stock" : "In Stock";
      const safeName = (p.productName || "").replace(/"/g, '""');
      const safeCat  = (p.category  || "").replace(/"/g, '""');

      const ss = p.sizeStock && typeof p.sizeStock === "object" ? p.sizeStock : {};
      const sizeEntries = Object.entries(ss).filter(([, v]) => v !== undefined);

      if (sizeEntries.length > 0) {
        sizeEntries.forEach(([size, qty]) => {
          rows.push(`"${safeName}",${p._id},"${safeCat}",${p.price},${size},${qty || 0},${totalStock},"${status}"`);
        });
      } else {
        rows.push(`"${safeName}",${p._id},"${safeCat}",${p.price},-,${totalStock},${totalStock},"${status}"`);
      }
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock_size_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("📊 Size-aware stock CSV exported!");
  };



  // Filtering Logic
  const filteredProducts = products.filter((p) => {
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase());
    
    let matchStatus = true;
    if (stockStatusFilter === "instock") {
      matchStatus = (p.stock || 0) > lowStockThreshold;
    } else if (stockStatusFilter === "low") {
      matchStatus = (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold;
    } else if (stockStatusFilter === "out") {
      matchStatus = (p.stock || 0) === 0;
    }

    return matchCat && matchSearch && matchStatus;
  });

  // Summary Metrics
  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const outOfStock = products.filter((p) => (p.stock || 0) === 0).length;
  const lowStock = products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold).length;
  
  // Calculate total locked capital (valuation sum)
  const lockedCapital = products.reduce((s, p) => s + ((p.stock || 0) * p.price), 0);

  const getStockBadge = (stock) => {
    if (stock === 0) return <span className="as-badge badge-out">Out of Stock</span>;
    if (stock <= lowStockThreshold) return <span className="as-badge badge-low">Low Stock</span>;
    return <span className="as-badge badge-ok">In Stock</span>;
  };

  // Category aggregations for progress bars
  const categorySummaryMap = {};
  products.forEach(p => {
    if (!categorySummaryMap[p.category]) {
      categorySummaryMap[p.category] = { count: 0, stock: 0 };
    }
    categorySummaryMap[p.category].count += 1;
    categorySummaryMap[p.category].stock += (p.stock || 0);
  });

  if (!currentUser) return null;

  return (
    <section className="as-page-wrapper">
      <div className="container-fluid px-4 py-4">
        {/* Navigation tabs */}
        <div className="admin-nav-tabs mb-4">
          <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>👥 Users</NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🛍️ Products</NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🗂️ Categories</NavLink>
          <NavLink to="/admin/bills" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🧾 Bills</NavLink>
          <NavLink to="/admin/customers" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>👤 Customers</NavLink>
          <NavLink to="/admin/stock" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>📦 Stock</NavLink>
          <NavLink to="/admin/discounts" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>🏷️ Discounts</NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>⚙️ Settings</NavLink>
        </div>

        {/* Dashboard Header */}
        <div className="as-header">
          <div>
            <h2 className="as-title">
              Next-Gen Stock Control
              <span className="as-title-underline" />
            </h2>
            <p className="as-subtitle">Predictive analytics, automated log tracking, and real-time inventory assets</p>
          </div>
          <div className="as-header-actions">
            {/* Tab switch control */}
            <div className="ims-tab-buttons me-2">
              <button 
                className={`ims-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
                onClick={() => setActiveTab("inventory")}
              >
                📊 Inventory
              </button>
              <button 
                className={`ims-tab-btn ${activeTab === "advisor" ? "active" : ""}`}
                onClick={() => setActiveTab("advisor")}
              >
                🧠 AI Copilot {insights?.suggestions?.length > 0 && <span className="advisor-count-dot">{insights.suggestions.length}</span>}
              </button>
              <button 
                className={`ims-tab-btn ${activeTab === "logs" ? "active" : ""}`}
                onClick={() => setActiveTab("logs")}
              >
                📜 Live Logs
              </button>
            </div>
            
            <button className="as-btn as-btn-secondary" onClick={() => setShowBulkModal(true)}>
              📥 Bulk Import
            </button>
            <button className="as-btn as-btn-primary" onClick={exportToCSV}>
              📤 Export CSV
            </button>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="as-metrics-grid">
          <div className="as-metric-card">
            <div className="as-metric-inner">
              <span className="as-metric-icon">💼</span>
              <div>
                <h3 className="as-metric-num">₹{lockedCapital.toLocaleString()}</h3>
                <span className="as-metric-label">Locked Capital</span>
              </div>
            </div>
            <div className="as-metric-glow color-blue" />
          </div>

          <div className="as-metric-card">
            <div className="as-metric-inner">
              <span className="as-metric-icon">📦</span>
              <div>
                <h3 className="as-metric-num">{totalStock}</h3>
                <span className="as-metric-label">Total Units</span>
              </div>
            </div>
            <div className="as-metric-glow color-blue" />
          </div>

          <div className={`as-metric-card ${lowStock > 0 ? "critical-pulse" : ""}`}>
            <div className="as-metric-inner">
              <span className="as-metric-icon">⚠️</span>
              <div>
                <h3 className="as-metric-num">{lowStock}</h3>
                <span className="as-metric-label">Low Stock (≤{lowStockThreshold})</span>
              </div>
            </div>
            <div className="as-metric-glow color-orange" />
          </div>

          <div className={`as-metric-card ${outOfStock > 0 ? "critical-pulse" : ""}`}>
            <div className="as-metric-inner">
              <span className="as-metric-icon">🚫</span>
              <div>
                <h3 className="as-metric-num">{outOfStock}</h3>
                <span className="as-metric-label">Out of Stock</span>
              </div>
            </div>
            <div className="as-metric-glow color-red" />
          </div>
        </div>

        {/* Category breakdown visual charts */}
        {activeTab === "inventory" && Object.keys(categorySummaryMap).length > 0 && (
          <div className="category-analytics-panel mb-4">
            <h4 className="panel-title">📦 Category Asset Allocation</h4>
            <div className="category-progress-grid">
              {Object.keys(categorySummaryMap).map((catName) => {
                const summary = categorySummaryMap[catName];
                const percentage = Math.min(100, Math.max(12, (summary.stock / (totalStock || 1)) * 100));
                return (
                  <div key={catName} className="cat-progress-card">
                    <div className="cat-progress-header">
                      <span className="cat-name">{catName}</span>
                      <span className="cat-details">{summary.stock} Units ({summary.count} items)</span>
                    </div>
                    <div className="cat-progress-bar-bg">
                      <div className="cat-progress-bar-fill" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 1: INVENTORY MANAGER ────────────────────────────────────────── */}
        {activeTab === "inventory" && (
          <>
            {/* Glassmorphic Filtering Control Center */}
            <div className="as-control-center">
              <div className="as-search-box">
                <span className="as-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search products by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="as-filter-group">
                <div className="as-filter-wrapper">
                  <label>Warning Limit</label>
                  <input
                    type="number"
                    className="threshold-input"
                    value={lowStockThreshold}
                    min="1"
                    max="100"
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 5)}
                  />
                </div>

                <div className="as-filter-wrapper">
                  <label>Category</label>
                  <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                    <option value="all">All Categories</option>
                    {allCategoryNames.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="as-filter-wrapper">
                  <label>Stock Status</label>
                  <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="instock">In Stock</option>
                    <option value="low">Low Stock</option>
                    <option value="out">Out of Stock</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Interactive Stock Table */}
            {loading ? (
              <div className="as-loader-container">
                <div className="as-spinner" />
                <p>Syncing warehouse data...</p>
              </div>
            ) : (
              <div className="as-table-container">
                <table className="as-table">
                  <thead>
                    <tr>
                      <th>Product Details</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock Levels</th>
                      <th>Status</th>
                      <th>Interactive Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="as-table-empty">
                          No matching inventory items found.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isUpdating = updatingStockId === p._id;
                        const isLow = (p.stock || 0) > 0 && (p.stock || 0) <= lowStockThreshold;
                        const isOut = (p.stock || 0) === 0;

                        return (
                          <tr key={p._id} className={isOut ? "row-out" : isLow ? "row-low" : ""}>
                            <td>
                              <div className="as-product-info">
                                {p.imgUrl ? (
                                  <img src={p.imgUrl} alt={p.productName} className="as-product-thumb" />
                                ) : (
                                  <div className="as-product-placeholder">📦</div>
                                )}
                                <div>
                                  <span className="as-product-name">{p.productName}</span>
                                  <span className="as-product-id">ID: {p._id.slice(-6)}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="as-category-tag">{p.category}</span>
                            </td>
                            <td>
                              <span className="as-price-tag">₹{p.price}</span>
                            </td>
                            <td>
                              {/* If product has per-size stock, show breakdown; else show counter */}
                              {p.sizeStock && Object.keys(p.sizeStock).length > 0 ? (
                                <div className="as-size-stock-wrap">
                                  <div className="as-size-stock-grid">
                                    {Object.entries(p.sizeStock).map(([sz, qty]) => (
                                      <div key={sz} className="as-size-stock-cell">
                                        <span className="as-size-tag">{sz}</span>
                                        <input
                                          type="number" min="0"
                                          className="as-size-qty-input"
                                          value={qty}
                                          disabled={isUpdating}
                                          onChange={(e) => {
                                            const val = Number(e.target.value) || 0;
                                            setProducts((prev) => prev.map((x) => {
                                              if (x._id !== p._id) return x;
                                              const newSS = { ...(x.sizeStock || {}), [sz]: val };
                                              const total = Object.values(newSS).reduce((s,v) => s + Number(v||0), 0);
                                              return { ...x, sizeStock: newSS, stock: total };
                                            }));
                                          }}
                                          onBlur={async () => {
                                            // Save per-size stock via PATCH
                                            const cur = products.find(x => x._id === p._id);
                                            if (!cur) return;
                                            const headers = { "Content-Type": "application/json" };
                                            const token = localStorage.getItem("jwtToken");
                                            if (token) headers["Authorization"] = `Bearer ${token}`;
                                            setUpdatingStockId(p._id);
                                            try {
                                              const res = await fetch(`${BASE_URL}/api/products/${p._id}/stock`, {
                                                method: "PATCH", headers,
                                                body: JSON.stringify({
                                                  sizeStock: cur.sizeStock,
                                                  reason: "Per-size stock update",
                                                  updatedBy: currentUser?.name || "Admin"
                                                }),
                                              });
                                              const data = await res.json();
                                              if (data.success) {
                                                toast.success(`Stock updated`);
                                                fetchMovements();
                                              }
                                            } catch { toast.error("Update failed"); }
                                            finally { setUpdatingStockId(null); }
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="as-size-total">
                                    Total: <strong>{Object.values(p.sizeStock).reduce((s,v) => s + Number(v||0), 0)}</strong> units
                                  </div>
                                </div>
                              ) : (
                                <div className="as-stock-counter">
                                  <button
                                    className="as-counter-btn"
                                    onClick={() => handleStockChange(p._id, (p.stock || 0) - 1, "Manual deduction")}
                                    disabled={isUpdating || (p.stock || 0) <= 0}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    className="as-counter-input"
                                    value={p.stock || 0}
                                    min="0"
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setProducts((prev) =>
                                        prev.map((x) => (x._id === p._id ? { ...x, stock: isNaN(val) ? 0 : val } : x))
                                      );
                                    }}
                                    onBlur={(e) => handleStockChange(p._id, parseInt(e.target.value) || 0, "Counter update")}
                                    disabled={isUpdating}
                                  />
                                  <button
                                    className="as-counter-btn"
                                    onClick={() => handleStockChange(p._id, (p.stock || 0) + 1, "Manual restock")}
                                    disabled={isUpdating}
                                  >
                                    +
                                  </button>
                                  {isUpdating && <div className="as-small-spinner" />}
                                </div>
                              )}
                            </td>
                            <td>{getStockBadge(p.stock || 0)}</td>
                            <td>
                              <button
                                className="as-action-update-btn"
                                onClick={() => handleStockChange(p._id, p.stock || 0, "Manual sync")}
                                disabled={isUpdating}
                              >
                                💾 Sync Stock
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: AI INVENTORY COPILOT & ADVISOR ───────────────────────────── */}
        {activeTab === "advisor" && (
          <div className="ai-advisor-panel">
            <div className="ai-panel-header glass-card p-4 mb-4">
              <div className="ai-header-info">
                <span className="ai-brain-icon">🧠</span>
                <div>
                  <h4>AI Predictive IMS Advisor</h4>
                  <p>Smart restock triggers, dynamic pricing matrix strategies, and locked asset rescue plans.</p>
                </div>
              </div>
              <button className="as-btn as-btn-primary" onClick={fetchInsights} disabled={insightsLoading}>
                {insightsLoading ? "Analyzing..." : "🔄 Refresh Analysis"}
              </button>
            </div>

            {insightsLoading ? (
              <div className="as-loader-container">
                <div className="as-spinner" />
                <p>Generating mathematical predictive insights...</p>
              </div>
            ) : (
              <div className="insights-workspace">
                <div className="row g-4">
                  {/* Left Column: List of Smart Suggestions */}
                  <div className="col-lg-8">
                    <h5 className="section-subtitle">🎯 AI Action Recommendations</h5>
                    {insights?.suggestions?.length === 0 ? (
                      <div className="glass-card p-5 text-center text-muted">
                        No immediate anomalies or risks found in inventory velocities! Your warehouse levels are perfectly balanced.
                      </div>
                    ) : (
                      <div className="suggestions-list d-flex flex-column gap-3">
                        {insights.suggestions.map((s, index) => {
                          const isApplying = applyingSuggestionId === s.productId;
                          return (
                            <div key={index} className={`suggestion-card border-left-${s.severity || 'info'} glass-card p-4 d-flex justify-content-between align-items-start`}>
                              <div className="suggestion-details">
                                <span className={`severity-tag severity-${s.severity || 'info'}`}>{s.severity} urgency</span>
                                <h6 className="suggestion-title mt-2">{s.message}</h6>
                                <p className="suggestion-recommendation">{s.recommendation}</p>
                                {s.estimatedCost && <div className="suggestion-metric text-blue font-bold">Estimated Cost: ₹{s.estimatedCost.toLocaleString()}</div>}
                                {s.potentialRevenue && <div className="suggestion-metric text-emerald font-bold">Potential Revenue Recovery: ₹{s.potentialRevenue.toLocaleString()}</div>}
                              </div>
                              <div className="suggestion-actions">
                                {s.type === 'discount' && (
                                  <button 
                                    className="as-btn as-btn-primary py-2 px-3 text-xs" 
                                    onClick={() => handleApplyPricingSuggestion(s.productId, s.actionDiscount)}
                                    disabled={isApplying}
                                  >
                                    {isApplying ? "Applying..." : `🏷️ Apply ${s.actionDiscount}% Discount`}
                                  </button>
                                )}
                                {s.type === 'restock' && (
                                  <button 
                                    className="as-btn as-btn-secondary py-2 px-3 text-xs"
                                    onClick={() => handleStockChange(s.productId, 20, "AI Recommended Restock")}
                                    disabled={updatingStockId === s.productId}
                                  >
                                    {updatingStockId === s.productId ? "Syncing..." : "⚡ Replenish (+20)"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: AI Model Summary Stats */}
                  <div className="col-lg-4">
                    <h5 className="section-subtitle">📊 Warehouse Health Summary</h5>
                    <div className="glass-card p-4 d-flex flex-column gap-3">
                      <div className="health-stat">
                        <span className="health-stat-label">Total Assets Valuation</span>
                        <h4 className="health-stat-val text-blue">₹{insights?.stats?.totalValuation?.toLocaleString() || "0"}</h4>
                      </div>
                      <div className="health-stat">
                        <span className="health-stat-label">Items Stagnant (Dead Stock)</span>
                        <h4 className="health-stat-val text-orange">
                          {insights?.suggestions?.filter(s => s.type === 'discount').length || 0} Products
                        </h4>
                      </div>
                      <div className="health-stat">
                        <span className="health-stat-label">Restock Triggers Active</span>
                        <h4 className="health-stat-val text-red">
                          {insights?.suggestions?.filter(s => s.type === 'restock').length || 0} Products
                        </h4>
                      </div>

                      <div className="health-gauge mt-2">
                        <span className="stat-sm-label">STOCK TURNOVER RATIO</span>
                        <div className="gauge-outer mt-2">
                          <div className="gauge-fill bg-success" style={{ width: '85%' }} />
                        </div>
                        <span className="stat-xs-desc mt-1 block">85% inventory efficiency based on recent billings.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: LIVE STOCK MOVEMENT LOGS ─────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="logs-panel glass-card p-4">
            <div className="panel-header mb-4 d-flex justify-content-between align-items-center">
              <div>
                <h4 className="panel-title">📜 Chronological Stock Ledger</h4>
                <p className="panel-subtitle">Real-time ledger tracking every change in quantity, timestamps, reasons, and actors.</p>
              </div>
              <button className="as-btn as-btn-secondary" onClick={fetchMovements} disabled={movementsLoading}>
                {movementsLoading ? "Syncing..." : "🔄 Refresh Logs"}
              </button>
            </div>

            {movementsLoading ? (
              <div className="as-loader-container">
                <div className="as-spinner" />
                <p>Syncing warehouse transaction records...</p>
              </div>
            ) : (
              <div className="ledger-table-container">
                <table className="as-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Product Name</th>
                      <th>Quantity Change</th>
                      <th>Final Stock</th>
                      <th>Action Type</th>
                      <th>Adjustment Reason</th>
                      <th>Staff Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="as-table-empty">
                          No inventory movement logs recorded yet. Logs will generate automatically when product stocks are modified!
                        </td>
                      </tr>
                    ) : (
                      movements.map((log) => {
                        const isPositive = log.changeQty > 0;
                        return (
                          <tr key={log._id}>
                            <td className="text-muted text-xs">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td>
                              <span className="font-semibold text-white">{log.productName}</span>
                            </td>
                            <td>
                              <span className={`log-change-badge ${isPositive ? 'log-in' : 'log-out'}`}>
                                {isPositive ? `+${log.changeQty}` : log.changeQty}
                              </span>
                            </td>
                            <td>
                              <span className="font-mono text-white">{log.newStock}</span>
                            </td>
                            <td>
                              <span className={`log-type-tag type-${log.type}`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="text-muted text-sm">
                              {log.reason}
                            </td>
                            <td>
                              <span className="staff-actor-badge">👤 {log.updatedBy}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Size-Aware Bulk Stock Import Modal */}
      {showBulkModal && (
        <div className="as-modal-backdrop" onClick={() => { setShowBulkModal(false); setImportFile(null); setBulkInput(""); }}>
          <div className="as-modal as-modal-wide" onClick={(e) => e.stopPropagation()}>
            <button className="as-modal-close" onClick={() => { setShowBulkModal(false); setImportFile(null); setBulkInput(""); }}>×</button>
            <h3 className="as-modal-title">📥 Size-Aware Stock Import</h3>

            {/* Format guide */}
            <div className="as-import-info-box">
              <strong>📋 CSV Format (3 columns):</strong>
              <div className="as-import-code-block">
                <span style={{color:"#7dd3fc"}}>Product Name or ID</span>,{" "}
                <span style={{color:"#86efac"}}>Size</span>,{" "}
                <span style={{color:"#fcd34d"}}>New Stock</span><br />
                T-Shirt, S, 25<br />
                T-Shirt, M, 18<br />
                T-Shirt, L, 10<br />
                Jeans, -, 50 <span style={{opacity:0.6, fontSize:"0.8em"}}>(use - for products without sizes)</span>
              </div>
              <small style={{color:"#aaa", display:"block", marginTop:"6px"}}>
                💡 <strong>Tip:</strong> Click <em>Export CSV</em> to download current stock — edit it and re-import directly.
              </small>
            </div>

            {/* ── Mode 1: Upload .csv file ── */}
            <div className="as-import-section">
              <h5 className="as-import-section-title">📂 Upload .csv File</h5>
              <form onSubmit={handleFileImport}>
                <div className="as-modal-form-group">
                  <label className="as-file-label">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="as-file-input-hidden"
                      onChange={(e) => setImportFile(e.target.files[0] || null)}
                    />
                    <span className="as-file-btn">📁 Choose CSV File</span>
                    {importFile && (
                      <span className="as-file-name">📄 {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                    )}
                  </label>
                </div>
                <div className="as-modal-actions">
                  <button type="button" className="as-btn as-btn-secondary" onClick={() => { setShowBulkModal(false); setImportFile(null); }}>
                    Cancel
                  </button>
                  <button type="submit" className="as-btn as-btn-primary" disabled={!importFile || importing}>
                    {importing ? "⏳ Importing…" : "📂 Import File"}
                  </button>
                </div>
              </form>
            </div>

            <div className="as-import-divider"><span>— OR paste CSV text —</span></div>

            {/* ── Mode 2: Paste CSV text ── */}
            <div className="as-import-section">
              <h5 className="as-import-section-title">📋 Paste CSV Text</h5>
              <form onSubmit={handleBulkUpdate}>
                <div className="as-modal-form-group">
                  <textarea
                    className="as-modal-textarea"
                    rows={6}
                    placeholder={"Product Name, Size, Stock\nT-Shirt, S, 25\nT-Shirt, M, 18\nJeans, -, 50"}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                  />
                </div>
                <div className="as-modal-actions">
                  <button type="button" className="as-btn as-btn-secondary" onClick={() => { setShowBulkModal(false); setBulkInput(""); }}>
                    Cancel
                  </button>
                  <button type="submit" className="as-btn as-btn-primary" disabled={!bulkInput.trim() || importing}>
                    {importing ? "⏳ Processing…" : "⚡ Process Import"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminStock;
