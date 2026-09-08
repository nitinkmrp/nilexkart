import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { loginUser } from "../../app/userSlice";
import {
  loginUserApi,
  requestRegisterOtpApi,
  verifyRegisterOtpApi,
  resendOtpApi,
  forgotPasswordApi,
  resetPasswordApi,
} from "../../services/userApi";
import { toast } from "react-toastify";
import "./LoginModal.css";

const LoginModal = ({ show, onClose }) => {
  const dispatch = useDispatch();
  const [tab, setTab] = useState("login"); // "login" | "register" | "forgot"
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Registration state
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regCooldown, setRegCooldown] = useState(0);
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "", confirmPassword: "", otp: "" });
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login state
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Forgot Password state
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [forgotForm, setForgotForm] = useState({ email: "", otp: "", newPassword: "", confirmPassword: "" });
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  // Cooldown timers
  useEffect(() => {
    let timer;
    if (regCooldown > 0) {
      timer = setInterval(() => setRegCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [regCooldown]);

  useEffect(() => {
    let timer;
    if (forgotCooldown > 0) {
      timer = setInterval(() => setForgotCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [forgotCooldown]);

  if (!show) return null;

  // ── Reset helper when switching modes ───────────
  const switchTab = (newTab) => {
    setTab(newTab);
    setLoading(false);
  };

  // ── 1. LOGIN HANDLER ────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const user = await loginUserApi(loginForm.email, loginForm.password);
      dispatch(loginUser(user));
      toast.success(`Welcome back, ${user.name || "User"}!`);
      onClose();
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── 2. REGISTER - STEP 1: REQUEST OTP ───────────
  const handleRequestRegOtp = async (e) => {
    e.preventDefault();
    const { email, password, confirmPassword } = regForm;
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await requestRegisterOtpApi(email, password);
      setRegOtpSent(true);
      setRegCooldown(60); // 60-second cooldown
      toast.success("OTP sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // ── 2. REGISTER - STEP 2: VERIFY OTP ────────────
  const handleVerifyRegOtp = async (e) => {
    e.preventDefault();
    const { email, password, otp, name } = regForm;
    if (!otp) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyRegisterOtpApi(email, password, otp.trim(), name);
      dispatch(loginUser(res.data));
      toast.success("Account created successfully! You are now logged in.");
      onClose();
    } catch (err) {
      toast.error(err.message || "Registration verification failed");
    } finally {
      setLoading(false);
    }
  };

  // ── RESEND OTP FOR REGISTRATION ─────────────────
  const handleResendRegOtp = async () => {
    if (regCooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendOtpApi(regForm.email, "register");
      setRegCooldown(60);
      toast.success("A fresh OTP has been sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  // ── 3. FORGOT PASSWORD - STEP 1: REQUEST CODE ───
  const handleRequestForgotOtp = async (e) => {
    e.preventDefault();
    if (!forgotForm.email) {
      toast.error("Please enter your registered email");
      return;
    }
    setLoading(true);
    try {
      await forgotPasswordApi(forgotForm.email);
      setForgotOtpSent(true);
      setForgotCooldown(60);
      toast.success("Password reset code sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  // ── 3. FORGOT PASSWORD - STEP 2: RESET PASSWORD ─
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const { email, otp, newPassword, confirmPassword } = forgotForm;
    if (!otp || !newPassword) {
      toast.error("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordApi(email, otp.trim(), newPassword);
      toast.success(res.message || "Password reset successful! Please log in.");
      setLoginForm({ email, password: "" });
      setForgotOtpSent(false);
      switchTab("login");
    } catch (err) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // ── RESEND OTP FOR FORGOT PASSWORD ──────────────
  const handleResendForgotOtp = async () => {
    if (forgotCooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendOtpApi(forgotForm.email, "forgot_password");
      setForgotCooldown(60);
      toast.success("A fresh reset code has been sent to your email!");
    } catch (err) {
      toast.error(err.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          &times;
        </button>

        {/* Modal Top Tabs */}
        {tab !== "forgot" && (
          <div className="modal-tabs">
            <button
              type="button"
              className={tab === "login" ? "active" : ""}
              onClick={() => switchTab("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={tab === "register" ? "active" : ""}
              onClick={() => {
                switchTab("register");
                setRegOtpSent(false);
              }}
            >
              Register
            </button>
          </div>
        )}

        {/* ─── TAB 1: LOGIN FORM ─── */}
        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Email address</label>
              <div className="input-icon-wrapper">
                <i className="fa fa-envelope input-icon" />
                <input
                  type="email"
                  className="form-control ps-5"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold mb-0">Password</label>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none forgot-link"
                  onClick={() => switchTab("forgot")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-icon-wrapper">
                <i className="fa fa-lock input-icon" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  className="form-control ps-5 pe-5"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  <i className={`fa ${showLoginPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn w-100 modal-submit-btn mt-2" disabled={loading}>
              {loading ? (
                <span>
                  <i className="fa fa-spinner fa-spin me-2" /> Logging in…
                </span>
              ) : (
                "Log In"
              )}
            </button>

            <p className="text-center mt-3 mb-0 text-muted" style={{ fontSize: 13 }}>
              Don't have an account?{" "}
              <span
                className="text-primary fw-semibold"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  switchTab("register");
                  setRegOtpSent(false);
                }}
              >
                Register here
              </span>
            </p>
          </form>
        )}

        {/* ─── TAB 2: REGISTER FORM (STEP 1: ENTER DETAILS) ─── */}
        {tab === "register" && !regOtpSent && (
          <form onSubmit={handleRequestRegOtp}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Your Name <small className="text-muted fw-normal">(Optional)</small></label>
              <div className="input-icon-wrapper">
                <i className="fa fa-user input-icon" />
                <input
                  type="text"
                  className="form-control ps-5"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Email address</label>
              <div className="input-icon-wrapper">
                <i className="fa fa-envelope input-icon" />
                <input
                  type="email"
                  className="form-control ps-5"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              <small className="text-muted d-block mt-1" style={{ fontSize: 11.5 }}>
                Allowed domains: Gmail, Yahoo, Outlook
              </small>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Password</label>
              <div className="input-icon-wrapper">
                <i className="fa fa-lock input-icon" />
                <input
                  type={showRegPassword ? "text" : "password"}
                  className="form-control ps-5 pe-5"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                >
                  <i className={`fa ${showRegPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn w-100 modal-submit-btn mt-2" disabled={loading}>
              {loading ? (
                <span>
                  <i className="fa fa-spinner fa-spin me-2" /> Sending OTP…
                </span>
              ) : (
                "Get Verification Code"
              )}
            </button>

            <p className="text-center mt-3 mb-0 text-muted" style={{ fontSize: 13 }}>
              Already have an account?{" "}
              <span
                className="text-primary fw-semibold"
                style={{ cursor: "pointer" }}
                onClick={() => switchTab("login")}
              >
                Log in
              </span>
            </p>
          </form>
        )}

        {/* ─── TAB 2: REGISTER FORM (STEP 2: VERIFY OTP + RESEND) ─── */}
        {tab === "register" && regOtpSent && (
          <form onSubmit={handleVerifyRegOtp}>
            <div className="otp-banner text-center mb-3">
              <i className="fa fa-paper-plane text-primary mb-2" style={{ fontSize: 24 }} />
              <h6 className="fw-bold mb-1">Enter Verification Code</h6>
              <p className="text-muted small mb-0">
                We sent a 6-digit code to <strong className="text-dark">{regForm.email}</strong>
              </p>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold text-center d-block">6-Digit OTP</label>
              <input
                type="text"
                className="form-control text-center fw-bold otp-input"
                maxLength={6}
                value={regForm.otp}
                onChange={(e) => setRegForm({ ...regForm, otp: e.target.value.replace(/\D/g, "") })}
                placeholder="123456"
                autoFocus
                required
              />
            </div>

            <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
              {loading ? (
                <span>
                  <i className="fa fa-spinner fa-spin me-2" /> Creating account…
                </span>
              ) : (
                "Verify & Create Account"
              )}
            </button>

            {/* Resend OTP Section */}
            <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                onClick={() => setRegOtpSent(false)}
              >
                <i className="fa fa-arrow-left me-1" /> Change Email
              </button>

              <button
                type="button"
                className="btn btn-sm resend-btn"
                onClick={handleResendRegOtp}
                disabled={regCooldown > 0 || resending}
              >
                {resending ? (
                  <span>
                    <i className="fa fa-spinner fa-spin me-1" /> Sending…
                  </span>
                ) : regCooldown > 0 ? (
                  <span>
                    <i className="fa fa-clock-o me-1" /> Resend in {regCooldown}s
                  </span>
                ) : (
                  <span>
                    <i className="fa fa-repeat me-1" /> Resend OTP
                  </span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ─── TAB 3: FORGOT PASSWORD ─── */}
        {tab === "forgot" && (
          <div className="forgot-wrapper">
            <div className="d-flex align-items-center mb-3">
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none p-0 me-2 text-dark"
                onClick={() => switchTab("login")}
              >
                <i className="fa fa-arrow-left fa-lg" />
              </button>
              <h5 className="fw-bold mb-0" style={{ color: "#0f3460" }}>
                Reset Password
              </h5>
            </div>

            {!forgotOtpSent ? (
              // Step 1: Request code
              <form onSubmit={handleRequestForgotOtp}>
                <p className="text-muted small mb-3">
                  Enter your registered email address and we'll send you a 6-digit verification code to reset your password.
                </p>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Email address</label>
                  <div className="input-icon-wrapper">
                    <i className="fa fa-envelope input-icon" />
                    <input
                      type="email"
                      className="form-control ps-5"
                      value={forgotForm.email}
                      onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn w-100 modal-submit-btn mt-2" disabled={loading}>
                  {loading ? (
                    <span>
                      <i className="fa fa-spinner fa-spin me-2" /> Sending Code…
                    </span>
                  ) : (
                    "Send Reset Code"
                  )}
                </button>

                <p className="text-center mt-3 mb-0 text-muted" style={{ fontSize: 13 }}>
                  Remembered your password?{" "}
                  <span
                    className="text-primary fw-semibold"
                    style={{ cursor: "pointer" }}
                    onClick={() => switchTab("login")}
                  >
                    Back to login
                  </span>
                </p>
              </form>
            ) : (
              // Step 2: Enter OTP & New Password
              <form onSubmit={handleResetPassword}>
                <div className="otp-banner text-center mb-3">
                  <i className="fa fa-key text-primary mb-2" style={{ fontSize: 24 }} />
                  <h6 className="fw-bold mb-1">Enter Reset Code</h6>
                  <p className="text-muted small mb-0">
                    We sent a 6-digit reset code to <strong className="text-dark">{forgotForm.email}</strong>
                  </p>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">6-Digit Code</label>
                  <input
                    type="text"
                    className="form-control text-center fw-bold otp-input"
                    maxLength={6}
                    value={forgotForm.otp}
                    onChange={(e) => setForgotForm({ ...forgotForm, otp: e.target.value.replace(/\D/g, "") })}
                    placeholder="123456"
                    autoFocus
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">New Password</label>
                  <div className="input-icon-wrapper">
                    <i className="fa fa-lock input-icon" />
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      className="form-control ps-5 pe-5"
                      value={forgotForm.newPassword}
                      onChange={(e) => setForgotForm({ ...forgotForm, newPassword: e.target.value })}
                      placeholder="At least 6 characters"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    >
                      <i className={`fa ${showForgotNewPassword ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Confirm New Password</label>
                  <div className="input-icon-wrapper">
                    <i className="fa fa-check-circle input-icon" />
                    <input
                      type="password"
                      className="form-control ps-5"
                      value={forgotForm.confirmPassword}
                      onChange={(e) => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn w-100 modal-submit-btn" disabled={loading}>
                  {loading ? (
                    <span>
                      <i className="fa fa-spinner fa-spin me-2" /> Resetting password…
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </button>

                {/* Resend Code Section */}
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 text-decoration-none text-muted"
                    onClick={() => setForgotOtpSent(false)}
                  >
                    <i className="fa fa-arrow-left me-1" /> Change Email
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm resend-btn"
                    onClick={handleResendForgotOtp}
                    disabled={forgotCooldown > 0 || resending}
                  >
                    {resending ? (
                      <span>
                        <i className="fa fa-spinner fa-spin me-1" /> Sending…
                      </span>
                    ) : forgotCooldown > 0 ? (
                      <span>
                        <i className="fa fa-clock-o me-1" /> Resend in {forgotCooldown}s
                      </span>
                    ) : (
                      <span>
                        <i className="fa fa-repeat me-1" /> Resend Code
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;

