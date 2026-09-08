// Base URL — change to your backend address if different
const BASE = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

// ── Helper for regular (public) requests ──────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

// ── Helper for admin-only write requests ──────────────
async function adminFetch(path, opts = {}) {
  const token = localStorage.getItem("jwtToken");
  
  const headers = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // For file uploads (FormData), we need to let the browser set Content-Type with boundary
  if (opts.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

// Public & Auth routes
export const getUserByEmail = (email)  => apiFetch(`/api/users/${encodeURIComponent(email)}`);

// ── Admin-only routes ──────────────────────────────────
export const getAllUsers    = ()            => adminFetch("/api/users");
export const createUser    = (body)        => adminFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
export const updateUser    = (email, body) => adminFetch(`/api/users/${encodeURIComponent(email)}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteUser    = (email)       => adminFetch(`/api/users/${encodeURIComponent(email)}`, { method: "DELETE" });

// ── Authentication API ─────────────────────────────────
// Login — hits the real backend JWT auth endpoint
export const loginUserApi = async (email, password) => {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  
  if (data.token) {
    localStorage.setItem("jwtToken", data.token);
  }
  
  return data.data; // return the user object
};

// Request Registration OTP
export const requestRegisterOtpApi = async (email, password) => {
  return await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
};

// Verify Registration OTP & create account
export const verifyRegisterOtpApi = async (email, password, otp, name) => {
  const data = await apiFetch("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, password, otp, name })
  });
  if (data.token) {
    localStorage.setItem("jwtToken", data.token);
  }
  return data;
};

// Resend OTP (for registration or forgot_password)
export const resendOtpApi = async (email, purpose = "register") => {
  return await apiFetch("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email, purpose })
  });
};

// Forgot Password - request reset code
export const forgotPasswordApi = async (email) => {
  return await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
};

// Reset Password - verify code and set new password
export const resetPasswordApi = async (email, otp, newPassword) => {
  return await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otp, newPassword })
  });
};

