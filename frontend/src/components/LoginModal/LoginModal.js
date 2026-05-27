import { useState } from "react";
import { useDispatch } from "react-redux";
import { loginUser } from "../../app/userSlice";
import { loginUserApi } from "../../services/userApi";
import { toast } from "react-toastify";
import "./LoginModal.css";

const LoginModal = ({ show, onClose }) => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm]     = useState({ email: "", password: "", otp: "" });

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

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const { email, password } = regForm;
    if (!email || !password) { toast.error("Email and password required"); return; }
    setLoading(true);
    try {
      const res = await fetch("https://final-project1-d3iz.onrender.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      
      setOtpSent(true);
      toast.success("OTP sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const { email, password, otp } = regForm;
    if (!otp) { toast.error("OTP required"); return; }
    setLoading(true);
    try {
      const res = await fetch("https://final-project1-d3iz.onrender.com/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      
      // Auto login with the returned token
      localStorage.setItem("jwtToken", data.token);
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
          <button className={tab === "login" ? "active" : ""} onClick={() => { setTab("login"); setOtpSent(false); }}>Login</button>
          <button className={tab === "register" ? "active" : ""} onClick={() => { setTab("register"); setOtpSent(false); }}>Register</button>
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
        {tab === "register" && !otpSent && (
          <form onSubmit={handleRequestOtp}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email" className="form-control"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="you@example.com"
              />
              <small className="text-muted">Must be a valid Gmail, Yahoo, or Outlook address.</small>
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
            <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
              {loading ? "Sending OTP…" : "Get OTP"}
            </button>
          </form>
        )}

        {tab === "register" && otpSent && (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-center text-success mb-3">An OTP has been sent to your email.</p>
            <div className="mb-3">
              <label className="form-label">Enter OTP</label>
              <input
                type="text" className="form-control"
                value={regForm.otp}
                onChange={(e) => setRegForm({ ...regForm, otp: e.target.value })}
                placeholder="Enter 6-digit OTP"
              />
            </div>
            <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
              {loading ? "Verifying…" : "Verify & Create Account"}
            </button>
            <p className="text-center mt-3 mb-0" style={{ fontSize: 13, color: "#666" }}>
              <span className="text-primary" style={{ cursor: "pointer" }} onClick={() => setOtpSent(false)}>
                Change Email
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
