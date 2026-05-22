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

  // Bulk stock update
  const handleBulkUpdate = async (e) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      toast.error("Please enter CSV data");
      return;
    }

    const lines = bulkInput.trim().split("\n");
    let successCount = 0;
    let failCount = 0;

    toast.info("Processing bulk updates...");
    
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      
      const productNameOrId = parts[0].trim();
      const stockVal = parseInt(parts[1].trim());

      if (isNaN(stockVal) || stockVal < 0) {
        failCount++;
        continue;
      }

      // Find product by ID or exact match name
      const foundProduct = products.find(
        (p) => p._id === productNameOrId || p.productName.toLowerCase() === productNameOrId.toLowerCase()
      );

      if (foundProduct) {
        try {
          const headers = { "Content-Type": "application/json" };
          const token = localStorage.getItem("jwtToken");
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(`${BASE_URL}/api/products/${foundProduct._id}/stock`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ 
              stock: stockVal,
              reason: "Bulk CSV Import",
              updatedBy: currentUser?.name || "Admin"
            }),
          });
          const data = await res.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully updated ${successCount} products!`);
      fetchProducts();
      fetchMovements();
      fetchInsights();
    }
    if (failCount > 0) {
      toast.warn(`Failed or skipped ${failCount} items.`);
    }

    setShowBulkModal(false);
    setBulkInput("");
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

  // CSV Export
  const exportToCSV = () => {
    if (products.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvHeaders = "Product Name,Category,Price,Current Stock,Status\n";
    const csvRows = filteredProducts.map((p) => {
      const status = p.stock === 0 ? "Out of Stock" : p.stock <= lowStockThreshold ? "Low Stock" : "In Stock";
      return `"${p.productName.replace(/"/g, '""')}","${p.category}",${p.price},${p.stock || 0},"${status}"`;
    }).join("\n");

    const blob = new Blob([csvHeaders + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report Downloaded!");
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

      {/* Bulk Stock Import Modal */}
      {showBulkModal && (
        <div className="as-modal-backdrop" onClick={() => setShowBulkModal(false)}>
          <div className="as-modal" onClick={(e) => e.stopPropagation()}>
            <button className="as-modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            <h3 className="as-modal-title">📥 Bulk Stock Update</h3>
            <p className="as-modal-desc">
              Paste your inventory sheet values below. Enter one item per line using the format: <br />
              <code>Product ID or Product Name, New Stock Value</code>
            </p>
            
            <form onSubmit={handleBulkUpdate}>
              <div className="as-modal-form-group">
                <textarea
                  className="as-modal-textarea"
                  rows={8}
                  placeholder="e.g.&#10;Apple iPhone 15, 20&#10;664ba0fb9a67cb3012a4b512, 100"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                />
              </div>

              <div className="as-modal-actions">
                <button type="button" className="as-btn as-btn-secondary" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="as-btn as-btn-primary">
                  Process Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminStock;
