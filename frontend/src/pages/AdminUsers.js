import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchAllUsers, registerUser, updateUserThunk,
  deleteUserThunk, clearMessages,
} from "../app/userSlice";
import { toast } from "react-toastify";
import "./AdminUsers.css";

const EMPTY_FORM = { name: "", email: "", password: "", gender: "" };

const AdminUsers = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { users, currentUser, loading, error, successMessage } = useSelector((s) => s.users);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // user being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Redirect non-admins
  useEffect(() => {
    if (!currentUser) { navigate("/"); return; }
    // remove admin check if you don't have roles yet
  }, [currentUser, navigate]);

  useEffect(() => { dispatch(fetchAllUsers()); }, [dispatch]);

  useEffect(() => {
    if (successMessage) { toast.success(successMessage); dispatch(clearMessages()); }
    if (error) { toast.error(error); dispatch(clearMessages()); }
  }, [successMessage, error, dispatch]);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowForm(true); };
  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: "", gender: user.gender });
    setEditTarget(user);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editTarget) {
      const updates = { name: form.name, gender: form.gender };
      if (form.password) updates.password = form.password;
      dispatch(updateUserThunk({ email: editTarget.email, updates }));
    } else {
      const { name, email, password, gender } = form;
      if (!name || !email || !password || !gender) { toast.error("All fields required"); return; }
      dispatch(registerUser({ name, email, password, gender }));
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) dispatch(deleteUserThunk(deleteTarget.email));
    setDeleteTarget(null);
  };

  const initials = (name) =>
    name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <section className="admin-users-page">
      <div className="container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h2 className="admin-title">User Management</h2>
            <p className="admin-sub">{users.length} total users</p>
          </div>
          <button className="btn admin-add-btn" onClick={openCreate}>
            + Add User
          </button>
        </div>

        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-box">
            <div className="stat-num">{users.length}</div>
            <div className="stat-lbl">Total Users</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{users.filter(u => u.gender === "Male" || u.gender === "M").length}</div>
            <div className="stat-lbl">Male</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{users.filter(u => u.gender === "Female" || u.gender === "F").length}</div>
            <div className="stat-lbl">Female</div>
          </div>
        </div>

        {/* Search */}
        <div className="admin-search-bar">
          <input
            className="form-control"
            placeholder="🔍  Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" style={{ color: "#0f3460" }} />
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="table admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Gender</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user._id || user.email} className={currentUser?.email === user.email ? "current-user-row" : ""}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="table-avatar">{initials(user.name)}</div>
                          <span className="user-name-cell">
                            {user.name}
                            {currentUser?.email === user.email && (
                              <span className="you-badge">you</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: 14 }}>{user.email}</td>
                      <td>
                        <span className="gender-pill">{user.gender}</span>
                      </td>
                      <td style={{ fontSize: 13, color: "#999" }}>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button className="btn btn-sm admin-edit-btn" onClick={() => openEdit(user)}>Edit</button>
                          <button className="btn btn-sm admin-del-btn" onClick={() => setDeleteTarget(user)}>Delete</button>
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

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="modal-backdrop-custom" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-x" onClick={() => setShowForm(false)}>×</button>
            <h5 className="mb-4">{editTarget ? "Edit User" : "Add New User"}</h5>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
              </div>
              {!editTarget && (
                <div className="mb-3">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Password {editTarget && <span className="text-muted">(leave blank to keep)</span>}</label>
                <input type="password" className="form-control" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="mb-4">
                <label className="form-label">Gender *</label>
                <select className="form-select" value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <button type="submit" className="btn w-100 admin-submit-btn" disabled={loading}>
                {loading ? "Saving…" : editTarget ? "Update User" : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="modal-backdrop-custom" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box modal-sm-box" onClick={(e) => e.stopPropagation()}>
            <h5 className="mb-2">Delete user?</h5>
            <p className="text-muted mb-4" style={{ fontSize: 14 }}>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) will be permanently deleted.
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

export default AdminUsers;
