import { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import "./AdminDiscounts.css";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";
const PRESETS  = [0, 5, 10, 15, 20, 25, 30, 40, 50, 70];

/* ──────────────────────────────────────
   Helper: save one product's discount
   ────────────────────────────────────── */
async function pushDiscount(product, discount) {
  const token = localStorage.getItem("jwtToken");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fd = new FormData();
  fd.append("productName", product.productName);
  fd.append("category",    product.category);
  fd.append("price",       product.price);
  fd.append("discount",    discount);
  fd.append("stock",       product.stock ?? 0);
  fd.append("shortDesc",   product.shortDesc   ?? "");
  fd.append("description", product.description ?? "");
  fd.append("imgUrl",      product.imgUrl      ?? "");
  fd.append("avgRating",   product.avgRating   ?? 0);
  if (product.sizes?.length) fd.append("sizes", product.sizes.join(", "));

  const res  = await fetch(`${BASE_URL}/api/products/${product._id}`, { method: "PUT", body: fd, headers });
  const data = await res.json();
  return data.success;
}

/* ══════════════════════════════════════
   AdminDiscounts Component
   ══════════════════════════════════════ */
const AdminDiscounts = () => {
  const navigate    = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);

  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [edits,     setEdits]     = useState({}); // { [productId]: number }
  const [saving,    setSaving]    = useState(false);

  // Wizard state
  const [selectedDisc, setSelectedDisc] = useState(null); // % number
  const [selectedCat,  setSelectedCat]  = useState(null); // category string

  // Individual table search
  const [search, setSearch] = useState("");

  useEffect(() => { if (!currentUser) navigate("/"); }, [currentUser, navigate]);

  /* ── Fetch products ── */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/products`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        const init = {};
        data.data.forEach((p) => { init[p._id] = p.discount ?? 0; });
        setEdits(init);
      }
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /* ── Unique categories ── */
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  /* ── Apply discount to entire category (local state only) ── */
  const applyToCategory = (cat, disc) => {
    setEdits((prev) => {
      const next = { ...prev };
      products.filter((p) => p.category === cat).forEach((p) => { next[p._id] = disc; });
      return next;
    });
  };

  /* ── One-click: pick discount THEN category → auto-apply ── */
  const handleCatClick = (cat) => {
    if (selectedDisc === null) {
      toast.info("Pick a discount % first, then tap a category");
      setSelectedCat(cat);
      return;
    }
    setSelectedCat(cat);
    applyToCategory(cat, selectedDisc);
    const count = products.filter((p) => p.category === cat).length;
    toast.success(`Applied ${selectedDisc}% to all ${count} products in "${cat}"`);
  };

  /* ── One-click: pick category THEN discount → auto-apply ── */
  const handleDiscClick = (d) => {
    setSelectedDisc(d);
    if (selectedCat) {
      applyToCategory(selectedCat, d);
      const count = products.filter((p) => p.category === selectedCat).length;
      toast.success(`Applied ${d}% to all ${count} products in "${selectedCat}"`);
    }
  };

  /* ── Category stats ── */
  const catStats = categories.map((cat) => {
    const prods    = products.filter((p) => p.category === cat);
    const pending  = prods.filter((p) => Number(edits[p._id]) !== Number(p.discount ?? 0));
    const catDisc  = edits[prods[0]?._id] ?? prods[0]?.discount ?? 0;
    const allSame  = prods.every((p) => Number(edits[p._id]) === Number(edits[prods[0]?._id]));
    return { cat, count: prods.length, pendingCount: pending.length, catDisc, allSame, prods };
  });

  /* ── Save all pending changes ── */
  const saveAll = async () => {
    const changed = products.filter((p) => Number(edits[p._id]) !== Number(p.discount ?? 0));
    if (!changed.length) { toast.info("No changes to save"); return; }
    setSaving(true);
    let ok = 0, fail = 0;
    for (const p of changed) {
      const success = await pushDiscount(p, edits[p._id]);
      success ? ok++ : fail++;
    }
    if (ok)   toast.success(`✅ ${ok} product${ok > 1 ? "s" : ""} updated!`);
    if (fail) toast.error(`❌ ${fail} update${fail > 1 ? "s" : ""} failed`);
    setSaving(false);
    fetchProducts(); // refresh
  };

  /* ── Stats ── */
  const pendingChanges = products.filter((p) => Number(edits[p._id]) !== Number(p.discount ?? 0)).length;
  const onSale         = products.filter((p) => (p.discount || 0) > 0).length;

  /* ── Filtered individual list ── */
  const filteredProds = products.filter((p) =>
    p.productName.toLowerCase().includes(search.toLowerCase())
  );

  if (!currentUser) return null;

  return (
    <section className="ad-page">
      <div className="container-fluid px-4 py-4">

        {/* ── Nav Tabs ── */}
        <div className="ap-nav-tabs mb-4">
          <NavLink to="/admin/users"      className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>👥 Users</NavLink>
          <NavLink to="/admin/products"   className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🛍️ Products</NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🗂️ Categories</NavLink>
          <NavLink to="/admin/bills"      className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🧾 Bills</NavLink>
          <NavLink to="/admin/customers"  className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>👤 Customers</NavLink>
          <NavLink to="/admin/stock"      className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>📦 Stock</NavLink>
          <NavLink to="/admin/discounts"  className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🏷️ Discounts</NavLink>
        </div>

        {/* ── Header ── */}
        <div className="ad-header">
          <div>
            <h2 className="ad-title">🏷️ Discount Management</h2>
            <p className="ad-sub">{products.length} products · {onSale} on sale · {pendingChanges > 0 ? <strong style={{color:"#d97706"}}>{pendingChanges} unsaved</strong> : "all saved"}</p>
          </div>
          <button
            className="ad-save-all-btn"
            onClick={saveAll}
            disabled={saving || pendingChanges === 0}
          >
            {saving ? "Saving…" : `💾 Save All${pendingChanges > 0 ? ` (${pendingChanges})` : ""}`}
          </button>
        </div>

        {/* ══════════════════════════════════
             ONE-CLICK WIZARD
             Step 1 → discount %  Step 2 → category
            ══════════════════════════════════ */}
        <div className="ad-wizard">
          {/* ── Step 1: choose discount % ── */}
          <div className="ad-wizard-section">
            <p className="ad-wizard-step">① Choose Discount %</p>
            <div className="ad-big-presets">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`ad-big-preset ${selectedDisc === d ? "active" : ""}`}
                  onClick={() => handleDiscClick(d)}
                >
                  {d === 0 ? "Remove\nDiscount" : `${d}%`}
                </button>
              ))}
            </div>
          </div>

          {/* ── Arrow ── */}
          <div className="ad-wizard-arrow">→</div>

          {/* ── Step 2: choose category ── */}
          <div className="ad-wizard-section">
            <p className="ad-wizard-step">② Apply to Category</p>
            <div className="ad-cat-grid">
              {loading ? (
                <div className="spinner-border" style={{ color: "#0f3460" }} />
              ) : categories.map((cat) => {
                const stat = catStats.find((s) => s.cat === cat);
                const isSelected = selectedCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`ad-cat-card ${isSelected ? "selected" : ""} ${stat?.pendingCount > 0 ? "dirty" : ""}`}
                    onClick={() => handleCatClick(cat)}
                    title={`Apply ${selectedDisc !== null ? selectedDisc + "%" : "selected discount"} to all products in ${cat}`}
                  >
                    <span className="ad-cat-card-name">{cat}</span>
                    <span className="ad-cat-card-count">{stat?.count} products</span>
                    <span className={`ad-cat-card-disc ${stat?.pendingCount > 0 ? "pending" : ""}`}>
                      {stat?.allSame
                        ? `${stat?.catDisc}% discount`
                        : "mixed discounts"}
                    </span>
                    {stat?.pendingCount > 0 && (
                      <span className="ad-cat-card-pending">{stat.pendingCount} pending</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Live preview of pending changes ── */}
        {pendingChanges > 0 && (
          <div className="ad-preview-bar">
            <span>📋 <strong>{pendingChanges}</strong> product{pendingChanges > 1 ? "s" : ""} with unsaved changes</span>
            <button className="ad-preview-reset" onClick={fetchProducts}>↺ Reset All</button>
            <button className="ad-save-inline-btn" onClick={saveAll} disabled={saving}>
              {saving ? "Saving…" : "💾 Save Now"}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════
             CATEGORY SUMMARY TABLE
            ══════════════════════════════════ */}
        <h3 className="ad-section-title">Category Overview</h3>
        <div className="ad-cat-summary-grid">
          {catStats.map(({ cat, count, catDisc, allSame, pendingCount }) => (
            <div key={cat} className={`ad-cat-summary-card ${pendingCount > 0 ? "dirty" : ""}`}>
              <div className="ad-cat-summary-top">
                <span className="ad-cat-summary-name">{cat}</span>
                <span className="ad-cat-summary-count">{count} products</span>
              </div>
              <div className="ad-cat-summary-disc">
                {allSame
                  ? <span className={`ad-disc-pill ${catDisc > 0 ? "active" : "none"}`}>{catDisc}% off</span>
                  : <span className="ad-disc-pill mixed">Mixed</span>}
              </div>
              {/* Quick set row */}
              <div className="ad-cat-quick-row">
                {[0, 10, 20, 30, 50].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`ad-quick-chip ${allSame && catDisc === d ? "active" : ""}`}
                    onClick={() => { applyToCategory(cat, d); toast.success(`${d}% applied to ${cat}`); }}
                  >
                    {d === 0 ? "None" : `${d}%`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════
             INDIVIDUAL PRODUCT TABLE
            ══════════════════════════════════ */}
        <div className="ad-individual-header">
          <h3 className="ad-section-title" style={{ margin: 0 }}>Individual Products</h3>
          <input
            className="ad-search"
            placeholder="🔍 Search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>SALE PRICE</th>
                <th>ORIGINAL</th>
                <th>DISCOUNT</th>
                <th>SET DISCOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredProds.map((p) => {
                const d       = Number(edits[p._id] ?? p.discount ?? 0);
                const isDirty = d !== Number(p.discount ?? 0);
                const orig    = d > 0 ? Math.round(p.price / (1 - d / 100)) : null;

                return (
                  <tr key={p._id} className={isDirty ? "ad-row-dirty" : ""}>
                    <td>
                      <div className="ad-product-cell">
                        {p.imgUrl
                          ? <img src={p.imgUrl} alt="" className="ad-thumb" />
                          : <div className="ad-thumb-placeholder">📦</div>}
                        <span className="ad-product-name">{p.productName}</span>
                      </div>
                    </td>
                    <td><span className="ad-cat-badge">{p.category}</span></td>
                    <td className="ad-price">₹{p.price}</td>
                    <td className="ad-original-price">{orig ? `₹${orig}` : "—"}</td>
                    <td>
                      <span className={`ad-disc-badge ${d >= 30 ? "high" : d > 0 ? "active" : "none"}`}>
                        {d}%
                      </span>
                    </td>
                    <td>
                      <div className="ad-preset-row">
                        {PRESETS.map((pv) => (
                          <button
                            key={pv}
                            type="button"
                            className={`ad-preset-chip ${d === pv ? "active" : ""}`}
                            onClick={() => setEdits((prev) => ({ ...prev, [p._id]: pv }))}
                          >
                            {pv === 0 ? "None" : `${pv}%`}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </section>
  );
};

export default AdminDiscounts;
