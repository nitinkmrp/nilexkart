// Base URL — change to your backend address if different
const BASE = process.env.REACT_APP_API_URL || "http://localhost:8800";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

export const getAllUsers   = ()             => apiFetch("/api/users");
export const getUserByEmail = (email)       => apiFetch(`/api/users/${encodeURIComponent(email)}`);
export const createUser   = (body)          => apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
export const updateUser   = (email, body)   => apiFetch(`/api/users/${encodeURIComponent(email)}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteUser   = (email)         => apiFetch(`/api/users/${encodeURIComponent(email)}`, { method: "DELETE" });

// Login — finds user by email and verifies password client-side
// (replace with a real /api/auth/login endpoint if you add one)
export const loginUserApi = async (email, password) => {
  const data = await getUserByEmail(email);
  const user = data.data;
  if (user.password !== password) throw new Error("Incorrect password");
  return user;
};
