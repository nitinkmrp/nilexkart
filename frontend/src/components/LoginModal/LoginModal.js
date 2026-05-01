import { useState } from "react";
import { useDispatch } from "react-redux";
import { loginUser, registerUser } from "../../app/userSlice";
import { loginUserApi } from "../../services/userApi";
import { createUser } from "../../services/userApi";
import { toast } from "react-toastify";
import "./LoginModal.css";

const LoginModal = ({ show, onClose }) => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm]     = useState({ name: "", email: "", password: "", gender: "" });

  if (!show) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) { toast.error("All fields required"); return; }
    setLoading(true);
    try {
      const user = await loginUserApi(loginForm.email, loginForm.password);
      dispatch(loginUser(user));
      toast.success(`Welcome back, ${user.name}!`);
      onClose();
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { name, email, password, gender } = regForm;
    if (!name || !email || !password || !gender) { toast.error("All fields required"); return; }
    setLoading(true);
    try {
      const data = await createUser({ name, email, password, gender });
      dispatch(loginUser(data.data));
      toast.success("Account created! You're logged in.");
      onClose();
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>

        {/* Tabs */}
        <div className="modal-tabs">
          <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Login</button>
          <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Register</button>
        </div>

        {/* Login Form */}
        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email" className="form-control"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password" className="form-control"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </button>
            <p className="text-center mt-3 mb-0" style={{ fontSize: 13, color: "#666" }}>
              No account?{" "}
              <span className="text-primary" style={{ cursor: "pointer" }} onClick={() => setTab("register")}>
                Register here
              </span>
            </p>
          </form>
        )}

        {/* Register Form */}
        {tab === "register" && (
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text" className="form-control"
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email" className="form-control"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password" className="form-control"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                placeholder="min 6 characters"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={regForm.gender}
                onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
