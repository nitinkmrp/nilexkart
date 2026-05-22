import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, NavLink } from "react-router-dom";
import {
  fetchCategories,
  createCategoryThunk,
  updateCategoryThunk,
  deleteCategoryThunk,
  clearCategoryMessages,
} from "../app/categorySlice";
import { toast } from "react-toastify";
import "./AdminCategories.css";

const EMPTY_FORM = { name: "", description: "", icon: "📦", isActive: true };

const ICON_SUGGESTIONS = ["📦", "👕", "👗", "👟", "💻", "📱", "🏠", "🍕", "🎮", "💄", "📚", "⌚", "🎒", "🛒", "🌿"];

const AdminCategories = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { categories, loading, error, successMessage } = useSelector((s) => s.categories);
  const { currentUser } = useSelector((s) => s.users);

  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterActive, setFilterActive] = useState("all"); // "all" | "active" | "inactive"

  // Redirect non-admins
  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => { dispatch(fetchCategories()); }, [dispatch]);

  useEffect(() => {
    if (successMessage) { toast.success(successMessage); dispatch(clearCategoryMessages()); }
    if (error)          { toast.error(error);            dispatch(clearCategoryMessages()); }
  }, [successMessage, error, dispatch]);

  // Filter + search
  const filtered = categories.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.description?.toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === "all"      ? true :
      filterActive === "active"   ? c.isActive :
                                    !c.isActive;
    return matchSearch && matchActive;
  });

  const activeCount   = categories.filter((c) =>  c.isActive).length;
  const inactiveCount = categories.filter((c) => !c.isActive).length;

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowForm(true); };
  const openEdit   = (cat) => {
    setForm({ name: cat.name, description: cat.description || "", icon: cat.icon || "📦", isActive: cat.isActive });
    setEditTarget(cat);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Category name is required"); return; }

    if (editTarget) {
      dispatch(updateCategoryThunk({ id: editTarget._id, updates: form }));
    } else {
      dispatch(createCategoryThunk(form));
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) dispatch(deleteCategoryThunk(deleteTarget._id));
    setDeleteTarget(null);
  };

  return (
    <section className="admin-categories-page">

      {/* ── Tab Navigation ── */}
      <div className="admin-nav-tabs">
        <NavLink to="/admin/users"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          👥 Users
        </NavLink>
        <NavLink to="/admin/products"    className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🛍️ Products
        </NavLink>
        <NavLink to="/admin/categories"  className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🗂️ Categories
          <span className="tab-badge">{categories.length}</span>
        </NavLink>
        <NavLink to="/admin/bills"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          🧾 Bills
        </NavLink>
        <NavLink to="/admin/customers"   className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          👤 Customers
        </NavLink>
        <NavLink to="/admin/stock"       className={({ isActive }) => `admin-nav-tab${isActive ? " active" : ""}`}>
          📦 Stock
        </NavLink>
      </div>

      <div className="container">

        {/* ── Header ── */}
        <div className="admin-header">
          <div>
            <h2 className="admin-title">Category Management</h2>
            <p className="admin-sub">{categories.length} total categories</p>
          </div>
          <button className="btn admin-add-btn" onClick={openCreate}>
            + Add Category
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="admin-stats">
          <div className="stat-box">
            <div className="stat-num">{categories.length}</div>
            <div className="stat-lbl">Total</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: "#10b981" }}>{activeCount}</div>
            <div className="stat-lbl">Active</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: "#ef4444" }}>{inactiveCount}</div>
            <div className="stat-lbl">Inactive</div>
          </div>
        </div>

        {/* ── Filters + Search ── */}
        <div className="d-flex gap-3 align-items-center mb-3 flex-wrap">
          <div className="admin-search-bar flex-grow-1" style={{ marginBottom: 0 }}>
            <input
              className="form-control"
              placeholder="🔍  Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2">
            {["all", "active", "inactive"].map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filterActive === f ? "btn-primary" : "btn-outline-secondary"}`}
                style={filterActive === f ? { background: "#0f3460", borderColor: "#0f3460" } : {}}
                onClick={() => setFilterActive(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
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
          <div className="admin-table-wrap">
            <table className="table admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No categories found
                    </td>
                  </tr>
                ) : (
                  filtered.map((cat) => (
                    <tr key={cat._id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="cat-icon-bubble">{cat.icon || "📦"}</div>
                          <span className="cat-name-cell">{cat.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cat-slug-cell">{cat.slug}</span>
                      </td>
                      <td style={{ fontSize: 13, color: "#666", maxWidth: 220 }}>
                        {cat.description || <span className="text-muted fst-italic">No description</span>}
                      </td>
                      <td>
                        <span className={`status-pill ${cat.isActive ? "active" : "inactive"}`}>
                          <span className="status-dot" />
                          {cat.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#999" }}>
                        {cat.createdAt
                          ? new Date(cat.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button className="btn btn-sm admin-edit-btn" onClick={() => openEdit(cat)}>Edit</button>
                          <button className="btn btn-sm admin-del-btn"  onClick={() => setDeleteTarget(cat)}>Delete</button>
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

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="modal-backdrop-custom" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setShowForm(false)}>×</button>
            <h5 className="mb-4">{editTarget ? "Edit Category" : "Add New Category"}</h5>
            <form onSubmit={handleSubmit}>

              {/* Name */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Category Name *</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Electronics"
                />
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description of this category…"
                />
              </div>

              {/* Icon picker */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Icon (emoji)</label>
                <div className="icon-preview-row">
                  <div className="icon-preview">{form.icon}</div>
                  <input
                    className="form-control"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="Paste an emoji…"
                    style={{ maxWidth: 140 }}
                  />
                </div>
                {/* Quick-pick grid */}
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {ICON_SUGGESTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className="btn btn-sm"
                      style={{
                        fontSize: 20, padding: "4px 8px",
                        background: form.icon === ic ? "#e8f0fe" : "#f6f9fc",
                        border: form.icon === ic ? "2px solid #0f3460" : "1px solid #e0e0e0",
                        borderRadius: 8,
                      }}
                      onClick={() => setForm({ ...form, icon: ic })}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="mb-4">
                <div className="toggle-row">
                  <span className="toggle-label">Active</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <span className="slider-knob" />
                  </label>
                </div>
              </div>

              <button type="submit" className="btn admin-submit-btn w-100" disabled={loading}>
                {loading ? "Saving…" : editTarget ? "Update Category" : "Create Category"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="modal-backdrop-custom" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box modal-sm-box" onClick={(e) => e.stopPropagation()}>
            <h5 className="mb-2">Delete category?</h5>
            <p className="text-muted mb-4" style={{ fontSize: 14 }}>
              <strong>{deleteTarget.name}</strong> will be permanently deleted. This action cannot be undone.
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={loading}>
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminCategories;
