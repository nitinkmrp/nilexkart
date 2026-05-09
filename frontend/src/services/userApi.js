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

// ── Public routes ──────────────────────────────────────
export const getUserByEmail = (email)  => apiFetch(`/api/users/${encodeURIComponent(email)}`);

// ── Admin-only routes ──────────────────────────────────
export const getAllUsers    = ()            => adminFetch("/api/users");
export const createUser    = (body)        => adminFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
export const updateUser    = (email, body) => adminFetch(`/api/users/${encodeURIComponent(email)}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteUser    = (email)       => adminFetch(`/api/users/${encodeURIComponent(email)}`, { method: "DELETE" });

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
