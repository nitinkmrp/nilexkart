import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { updateUserThunk, deleteUserThunk, logoutUser, clearMessages } from "../app/userSlice";
import { toast } from "react-toastify";
import "./Profile.css";

const Profile = () => {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { currentUser, loading, error, successMessage } = useSelector((s) => s.users);

  const [activeTab, setActiveTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", gender: "", password: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) { navigate("/"); return; }
    setForm({ name: currentUser.name, gender: currentUser.gender, password: "" });
  }, [currentUser, navigate]);

  useEffect(() => {
    if (successMessage) { toast.success(successMessage); dispatch(clearMessages()); }
    if (error)          { toast.error(error);            dispatch(clearMessages()); }
  }, [successMessage, error, dispatch]);

  const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:8888";

  useEffect(() => {
    if (activeTab === "orders" && currentUser) {
      setOrdersLoading(true);
      fetch(`${baseUrl}/api/payment/orders/${currentUser.email}`)
        .then(res => res.json())
        .then(data => { if (data.success) setOrders(data.orders); })
        .catch(err => console.error("Error fetching orders:", err))
        .finally(() => setOrdersLoading(false));
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (activeTab === "waitlist" && currentUser) {
      setWaitlistLoading(true);
      fetch(`${baseUrl}/api/waitlist/${encodeURIComponent(currentUser.email)}`)
        .then(res => res.json())
        .then(data => { if (data.success) setWaitlist(data.data); })
        .catch(err => console.error("Error fetching waitlist:", err))
        .finally(() => setWaitlistLoading(false));
    }
  }, [activeTab, currentUser]);

  const handleRemoveWaitlist = async (productId) => {
    try {
      const res = await fetch(
        `${baseUrl}/api/waitlist/${encodeURIComponent(currentUser.email)}/${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setWaitlist(prev => prev.filter(item => item.productId !== productId));
        toast.success("Removed from waitlist");
      } else {
        toast.error(data.message || "Failed to remove");
      }
    } catch (err) {
      toast.error("Error removing item");
    }
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const updates = { name: form.name, gender: form.gender };
    if (form.password) updates.password = form.password;
    dispatch(updateUserThunk({ email: currentUser.email, updates }));
    setEditing(false);
  };

  const handleDeleteAccount = () => {
    dispatch(deleteUserThunk(currentUser.email)).then(() => {
      dispatch(logoutUser());
      toast.success("Account deleted. We'll miss you!");
      navigate("/");
    });
  };

  const handleSignOut = () => {
    dispatch(logoutUser());
    toast.info("You have successfully signed out.");
    navigate("/");
  };

  const initials = (name) =>
    name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  if (!currentUser) return null;

  return (
    <section className="profile-page">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-9">

            {/* Profile Header Card */}
            <div className="profile-header-card mb-4">
              <div className="profile-avatar-lg">{initials(currentUser.name)}</div>
              <div className="flex-grow-1">
                <h2 className="profile-name">{currentUser.name}</h2>
                <p className="profile-email">{currentUser.email}</p>
                <span className="profile-badge">{currentUser.gender}</span>
              </div>
              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn profile-edit-btn"
                  onClick={() => { setActiveTab("details"); setEditing(!editing); }}
                >
                  {editing ? "Cancel Edit" : "✏ Edit Profile"}
                </button>
                <button className="btn profile-signout-btn" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="profile-tabs mb-4">
              <button 
                className={`profile-tab ${activeTab === "details" ? "active" : ""}`}
                onClick={() => setActiveTab("details")}
              >
                Account Details
              </button>
              <button 
                className={`profile-tab ${activeTab === "orders" ? "active" : ""}`}
                onClick={() => { setActiveTab("orders"); setEditing(false); }}
              >
                My Orders
              </button>
              <button 
                className={`profile-tab ${activeTab === "waitlist" ? "active" : ""}`}
                onClick={() => { setActiveTab("waitlist"); setEditing(false); }}
              >
                Waitlist
              </button>
            </div>

            {/* Tab Content: Details */}
            {activeTab === "details" && (
              <>
                {/* Edit Form */}
                {editing && (
                  <div className="profile-card mb-4">
                    <h5 className="mb-4">Edit Profile</h5>
                    <form onSubmit={handleUpdate}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Full Name</label>
                          <input
                            className="form-control"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Gender</label>
                          <select
                            className="form-select"
                            value={form.gender}
                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label">New Password <span className="text-muted">(leave blank to keep current)</span></label>
                          <input
                            type="password" className="form-control"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="col-12">
                          <button type="submit" className="btn profile-save-btn" disabled={loading}>
                            {loading ? "Saving…" : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* Account Info */}
                <div className="profile-card mb-4">
                  <h5 className="mb-4">Account Overview</h5>
                  <div className="profile-info-grid">
                    <div className="profile-info-item">
                      <span className="info-label">Full name</span>
                      <span className="info-value">{currentUser.name}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">Email</span>
                      <span className="info-value">{currentUser.email}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">Gender</span>
                      <span className="info-value">{currentUser.gender}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">Member since</span>
                      <span className="info-value">
                        {currentUser.createdAt
                          ? new Date(currentUser.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="profile-card danger-zone">
                  <h5 className="text-danger mb-2">Danger Zone</h5>
                  <p className="text-muted mb-3" style={{ fontSize: 14 }}>
                    Permanently delete your account and all data. This cannot be undone.
                  </p>
                  {!showDeleteConfirm ? (
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
                      Delete My Account
                    </button>
                  ) : (
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <span style={{ fontSize: 14 }}>Are you sure?</span>
                      <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount} disabled={loading}>
                        {loading ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tab Content: Orders */}
            {activeTab === "orders" && (
              <div className="profile-card">
                <h5 className="mb-4">Order History</h5>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersLoading ? (
                        <tr>
                          <td colSpan="4" className="text-center py-3">Loading orders...</td>
                        </tr>
                      ) : orders.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-3">No orders found. Start shopping!</td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order._id}>
                            <td>#{order.razorpayOrderId}</td>
                            <td>{new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td>
                            <td><span className="badge bg-success">{order.status}</span></td>
                            <td>₹{order.totalAmount}.00</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab Content: Waitlist */}
            {activeTab === "waitlist" && (
              <div className="profile-card">
                <h5 className="mb-4">My Waitlist</h5>

                {waitlistLoading ? (
                  <p className="text-center text-muted py-3">Loading waitlist…</p>
                ) : waitlist.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted mb-1">Your waitlist is empty.</p>
                    <small className="text-muted">Add out-of-stock products to be notified when they're back.</small>
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {waitlist.map(item => (
                      <div
                        key={item._id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0 py-3"
                      >
                        <div className="d-flex gap-3 align-items-center">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6 }}
                            />
                          ) : (
                            <div
                              className="bg-light rounded d-flex align-items-center justify-content-center"
                              style={{ width: 50, height: 50, fontSize: 22 }}
                            >
                              🛍️
                            </div>
                          )}
                          <div>
                            <h6 className="mb-1">{item.productName}</h6>
                            {item.price > 0 && (
                              <small className="text-muted">₹{item.price}</small>
                            )}
                            <br />
                            <small className="text-muted">
                              Added: {new Date(item.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </small>
                          </div>
                        </div>
                        <div className="d-flex gap-2 align-items-center">
                          <span className={`badge ${item.status === "Back in Stock" ? "bg-success" : "bg-secondary"}`}>
                            {item.status}
                          </span>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleRemoveWaitlist(item.productId)}
                            title="Remove from waitlist"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
};

export default Profile;
