// Base URL — change to your backend address if different
const BASE = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY || "";

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
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
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

// Login — finds user by email and verifies password client-side
// (replace with a real /api/auth/login endpoint if you add one)
export const loginUserApi = async (email, password) => {
  const data = await getUserByEmail(email);
  const user = data.data;
  if (user.password !== password) throw new Error("Incorrect password");
  return user;
};
