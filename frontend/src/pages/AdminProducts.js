import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import { fetchCategories } from "../app/categorySlice";
import "./AdminProducts.css";

const BASE_URL   = process.env.REACT_APP_API_URL  || "https://final-project1-d3iz.onrender.com";
const ADMIN_KEY  = process.env.REACT_APP_ADMIN_KEY || "";
const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY || "";

const EMPTY_FORM = {
  productName: "", category: "", price: "", discount: "0",
  stock: "0", shortDesc: "", description: "", imgUrl: "", avgRating: "4.5",
};

const AdminProducts = () => {
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);
  const { categories: dbCategories } = useSelector((s) => s.categories);

  // Build category name list from DB; fall back to slugs already on products
  const categoryNames = dbCategories
    .filter((c) => c.isActive)
    .map((c) => c.name);

  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState("");
  const [catFilter, setCatFilter]       = useState("all");
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [aiLoading, setAiLoading]       = useState(false); // Gemini AI
  const fileInputRef = useRef();

  useEffect(() => { if (!currentUser) navigate("/"); }, [currentUser, navigate]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/products`);
      const data = await res.json();
      if (data.success) setProducts(data.data);
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchProducts();
    dispatch(fetchCategories());   // always pull latest categories
  }, [dispatch]);

  // Derive unique category values that exist on products (as fallback)
  const productCats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  // Final list: prefer DB categories, fallback to whatever is on products
  const allCategoryNames = categoryNames.length > 0 ? categoryNames : productCats;

  // ── Gemini AI Description Generator ─────────────────
  const generateDescriptions = async (target = "both") => {
    if (!form.productName.trim()) {
      toast.error("Please enter a product name first");
      return;
    }
    if (!GEMINI_KEY || GEMINI_KEY.includes("Demo")) {
      toast.error("Gemini API key not set. Add REACT_APP_GEMINI_KEY to frontend/.env");
      return;
    }
    setAiLoading(true);
    try {
      const productInfo = [
        `Product: ${form.productName}`,
        form.category ? `Category: ${form.category}` : "",
        form.price    ? `Price: ₹${form.price}`      : "",
      ].filter(Boolean).join(", ");

      const prompt = target === "short"
        ? `Write a concise, punchy one-line marketing tagline (max 15 words) for this product: ${productInfo}. Return only the tagline text, no quotes.`
        : target === "full"
        ? `Write a compelling full product description (3–4 sentences, ~80 words) for an e-commerce website for: ${productInfo}. Include key features, benefits, and a call to action. Return only the description text.`
        : `Generate product copy for an e-commerce site for: ${productInfo}.
Return a JSON object with exactly two keys:
- "short": a catchy one-line tagline (max 15 words)
- "full": a compelling product description in 3–4 sentences (~80 words) including key features and a call to action.
Return ONLY the raw JSON object, no markdown, no code fences.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || "Gemini API error");
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (target === "both") {
        try {
          // Strip any accidental markdown fences
          const clean = text.replace(/```json|```/gi, "").trim();
          const parsed = JSON.parse(clean);
          setForm((prev) => ({
            ...prev,
            shortDesc:   parsed.short || prev.shortDesc,
            description: parsed.full  || prev.description,
          }));
          toast.success("✨ AI generated both descriptions!");
        } catch {
          // Fallback: put everything in full description
          setForm((prev) => ({ ...prev, description: text }));
          toast.success("✨ AI description generated!");
        }
      } else if (target === "short") {
        setForm((prev) => ({ ...prev, shortDesc: text }));
        toast.success("✨ Short description generated!");
      } else {
        setForm((prev) => ({ ...prev, description: text }));
        toast.success("✨ Full description generated!");
      }
    } catch (err) {
      toast.error(`AI error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered list
  const filtered = products.filter((p) => {
    const matchCat    = catFilter === "all" || p.category === catFilter;
    const matchSearch = p.productName.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Stats ────────────────────────────────────────────
  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const outOfStock = products.filter((p) => (p.stock || 0) === 0).length;
  const lowStock   = products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length;

  // ── Form helpers ─────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM, category: allCategoryNames[0] || "" });
    setEditTarget(null);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({
      productName: p.productName, category: p.category,
      price: p.price, discount: p.discount || 0,
      stock: p.stock || 0, shortDesc: p.shortDesc || "",
      description: p.description || "", imgUrl: p.imgUrl || "",
      avgRating: p.avgRating || 0,
    });
    setImageFile(null);
    setImagePreview(p.imgUrl || null);
    setEditTarget(p);
    setShowForm(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.category || !form.price) {
      toast.error("Name, category and price are required");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append("image", imageFile);

      const url    = editTarget ? `${BASE_URL}/api/products/${editTarget._id}` : `${BASE_URL}/api/products`;
      const method = editTarget ? "PUT" : "POST";
      const res    = await fetch(url, { method, body: fd, headers: { "x-admin-key": ADMIN_KEY } });
      const data   = await res.json();

      if (data.success) {
        toast.success(editTarget ? "Product updated!" : "Product created!");
        setShowForm(false);
        setEditTarget(null);
        fetchProducts();
      } else {
        toast.error(data.message || "Failed to save product");
      }
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res  = await fetch(`${BASE_URL}/api/products/${deleteTarget._id}`, {
        method: "DELETE",
        headers: { "x-admin-key": ADMIN_KEY },
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Product deleted");
        setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      } else {
        toast.error(data.message || "Failed to delete");
      }
    } catch { toast.error("Network error"); }
    finally { setDeleteTarget(null); }
  };

  // Inline stock update
  const handleStockChange = async (id, newStock) => {
    if (newStock < 0) return;
    try {
      const res  = await fetch(`${BASE_URL}/api/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
        body: JSON.stringify({ stock: newStock }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) => prev.map((p) => p._id === id ? { ...p, stock: data.data.stock } : p));
        toast.success("Stock updated");
      }
    } catch { toast.error("Failed to update stock"); }
  };

  const stockBadge = (stock) => {
    if (stock === 0)    return <span className="ap-badge ap-badge-out">Out of Stock</span>;
    if (stock <= 5)     return <span className="ap-badge ap-badge-low">Low Stock</span>;
    return                     <span className="ap-badge ap-badge-ok">In Stock</span>;
  };

  const imgSrc = (p) => p.imgUrl || null;

  if (!currentUser) return null;

  return (
    <section className="ap-page">
      <div className="container-fluid px-4 py-4">

        {/* ── Admin Nav Tabs ── */}
        <div className="ap-nav-tabs mb-4">
          <NavLink to="/admin/users"       className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>👥 Users</NavLink>
          <NavLink to="/admin/products"    className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🛍️ Products</NavLink>
          <NavLink to="/admin/categories"  className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🗂️ Categories</NavLink>
          <NavLink to="/admin/bills"       className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>🧾 Bills</NavLink>
          <NavLink to="/admin/customers"   className={({ isActive }) => `ap-nav-tab${isActive ? " active" : ""}`}>👤 Customers</NavLink>
        </div>

        {/* ── Header ── */}
        <div className="ap-header">
          <div>
            <h2 className="ap-title">Product Management</h2>
            <p className="ap-sub">{products.length} total products</p>
          </div>
          <button className="ap-add-btn" onClick={openCreate}>+ Add Product</button>
        </div>

        {/* ── Stats ── */}
        <div className="ap-stats">
          <div className="ap-stat-box">
            <div className="ap-stat-icon">📦</div>
            <div>
              <div className="ap-stat-num">{products.length}</div>
              <div className="ap-stat-lbl">Total Products</div>
            </div>
          </div>
          <div className="ap-stat-box">
            <div className="ap-stat-icon">✅</div>
            <div>
              <div className="ap-stat-num">{totalStock}</div>
              <div className="ap-stat-lbl">Total Stock Units</div>
            </div>
          </div>
          <div className="ap-stat-box ap-stat-warn">
            <div className="ap-stat-icon">⚠️</div>
            <div>
              <div className="ap-stat-num">{lowStock}</div>
              <div className="ap-stat-lbl">Low Stock (≤5)</div>
            </div>
          </div>
          <div className="ap-stat-box ap-stat-danger">
            <div className="ap-stat-icon">🚫</div>
            <div>
              <div className="ap-stat-num">{outOfStock}</div>
              <div className="ap-stat-lbl">Out of Stock</div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="ap-filters">
          <input
            className="ap-search"
            placeholder="🔍 Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ap-cat-pills">
            {["all", ...allCategoryNames].map((c) => (
              <button
                key={c}
                className={`ap-cat-pill ${catFilter === c ? "active" : ""}`}
                onClick={() => setCatFilter(c)}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#0f3460" }} />
          </div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Discount</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="ap-empty">No products found</td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p._id} className={(p.stock || 0) === 0 ? "ap-row-out" : (p.stock || 0) <= 5 ? "ap-row-low" : ""}>
                      <td>
                        <div className="ap-product-cell">
                          {imgSrc(p) ? (
                            <img src={imgSrc(p)} alt={p.productName} className="ap-thumb" />
                          ) : (
                            <div className="ap-thumb-placeholder">📦</div>
                          )}
                          <span className="ap-product-name">{p.productName}</span>
                        </div>
                      </td>
                      <td><span className="ap-cat-badge">{p.category}</span></td>
                      <td className="ap-price">₹{p.price}</td>
                      <td>{p.discount || 0}%</td>
                      <td>
                        <div className="ap-stock-ctrl">
                          <button className="ap-stock-btn" onClick={() => handleStockChange(p._id, (p.stock || 0) - 1)}>−</button>
                          <input
                            className="ap-stock-input"
                            type="number" min="0"
                            value={p.stock || 0}
                            onChange={(e) => setProducts((prev) =>
                              prev.map((x) => x._id === p._id ? { ...x, stock: Number(e.target.value) } : x)
                            )}
                            onBlur={(e) => handleStockChange(p._id, Number(e.target.value))}
                          />
                          <button className="ap-stock-btn" onClick={() => handleStockChange(p._id, (p.stock || 0) + 1)}>+</button>
                        </div>
                      </td>
                      <td>{stockBadge(p.stock || 0)}</td>
                      <td>⭐ {p.avgRating || 0}</td>
                      <td>
                        <div className="ap-actions">
                          <button className="ap-edit-btn" onClick={() => openEdit(p)}>✏️ Edit</button>
                          <button className="ap-del-btn" onClick={() => setDeleteTarget(p)}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="ap-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ap-modal-close" onClick={() => setShowForm(false)}>×</button>
            <h5 className="ap-modal-title">{editTarget ? "✏️ Edit Product" : "➕ Add New Product"}</h5>

            <form onSubmit={handleSubmit}>
              {/* Image Upload */}
              <div className="ap-image-upload-area" onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="ap-img-preview" />
                ) : (
                  <div className="ap-upload-placeholder">
                    <span className="ap-upload-icon">📷</span>
                    <span>Click to upload image</span>
                    <small>JPG, PNG, WebP — max 5MB</small>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageChange}
                />
              </div>
              {imagePreview && (
                <button type="button" className="ap-clear-img" onClick={() => { setImageFile(null); setImagePreview(null); setForm({...form, imgUrl: ""}); }}>
                  Remove Image
                </button>
              )}

              {/* Or URL */}
              <div className="ap-form-group">
                <label>Image URL <span className="ap-hint">(optional if uploaded above)</span></label>
                <input
                  className="ap-input"
                  value={form.imgUrl}
                  onChange={(e) => { setForm({ ...form, imgUrl: e.target.value }); if (e.target.value) setImagePreview(e.target.value); }}
                  placeholder="https://example.com/product.jpg"
                />
              </div>

              {/* Two columns */}
              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label>Product Name *</label>
                  <input className="ap-input" value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="e.g. Apple iPhone 15" />
                </div>
                <div className="ap-form-group">
                  <label>Category *</label>
                  <select className="ap-input" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {allCategoryNames.length === 0 ? (
                      <option value="">No categories yet — add them first</option>
                    ) : (
                      allCategoryNames.map((c) => <option key={c} value={c}>{c}</option>)
                    )}
                  </select>
                </div>
              </div>

              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label>Price (₹) *</label>
                  <input className="ap-input" type="number" min="0" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
                </div>
                <div className="ap-form-group">
                  <label>Discount (%)</label>
                  <input className="ap-input" type="number" min="0" max="100" value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" />
                </div>
              </div>

              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label>Stock Units</label>
                  <input className="ap-input" type="number" min="0" value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                </div>
                <div className="ap-form-group">
                  <label>Avg Rating (0–5)</label>
                  <input className="ap-input" type="number" min="0" max="5" step="0.1" value={form.avgRating}
                    onChange={(e) => setForm({ ...form, avgRating: e.target.value })} placeholder="4.5" />
                </div>
              </div>

              {/* AI Description Assistant */}
              <div className="ai-assistant-bar">
                <div className="ai-badge">✨ AI Assistant</div>
                <span className="ai-hint">Auto-write descriptions using Gemini AI</span>
                <button
                  type="button"
                  className={`ai-gen-btn ${aiLoading ? "ai-gen-loading" : ""}`}
                  onClick={() => generateDescriptions("both")}
                  disabled={aiLoading}
                  title="Generate both short and full description using Gemini AI"
                >
                  {aiLoading ? (
                    <><span className="ai-spinner" /> Generating…</>
                  ) : (
                    <>✨ Write Both</>
                  )}
                </button>
              </div>

              <div className="ap-form-group">
                <div className="ai-label-row">
                  <label>Short Description</label>
                  <button type="button" className="ai-mini-btn"
                    onClick={() => generateDescriptions("short")}
                    disabled={aiLoading}
                    title="Generate short description only">
                    ✨ AI
                  </button>
                </div>
                <input className="ap-input" value={form.shortDesc}
                  onChange={(e) => setForm({ ...form, shortDesc: e.target.value })}
                  placeholder="One-line summary…" />
              </div>

              <div className="ap-form-group">
                <div className="ai-label-row">
                  <label>Full Description</label>
                  <button type="button" className="ai-mini-btn"
                    onClick={() => generateDescriptions("full")}
                    disabled={aiLoading}
                    title="Generate full description only">
                    ✨ AI
                  </button>
                </div>
                <textarea className="ap-input ap-textarea" rows={3} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed product description…" />
              </div>

              <button type="submit" className="ap-submit-btn" disabled={saving}>
                {saving ? "Saving…" : editTarget ? "Update Product" : "Create Product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="ap-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="ap-modal ap-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h5 className="ap-modal-title">🗑️ Delete Product?</h5>
            <p className="ap-del-msg">
              <strong>{deleteTarget.productName}</strong> will be permanently removed.
            </p>
            <div className="ap-del-actions">
              <button className="ap-cancel-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="ap-confirm-del-btn" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminProducts;
