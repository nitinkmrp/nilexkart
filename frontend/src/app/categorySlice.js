import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const BASE = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("jwtToken");
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

// ── Async thunks ─────────────────────────────────────
export const fetchCategories = createAsyncThunk("categories/fetchAll", async () => {
  const data = await apiFetch("/api/categories");
  return data.data;
});

export const createCategoryThunk = createAsyncThunk(
  "categories/create",
  async (body, { rejectWithValue }) => {
    try {
      const data = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return data.data;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

export const updateCategoryThunk = createAsyncThunk(
  "categories/update",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const data = await apiFetch(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return data.data;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

export const deleteCategoryThunk = createAsyncThunk(
  "categories/delete",
  async (id, { rejectWithValue }) => {
    try {
      await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      return id;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

// ── Slice ─────────────────────────────────────────────
const categorySlice = createSlice({
  name: "categories",
  initialState: {
    categories:     [],
    loading:        false,
    error:          null,
    successMessage: null,
  },
  reducers: {
    clearCategoryMessages(state) {
      state.error          = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAll
    builder
      .addCase(fetchCategories.pending,  (s) => { s.loading = true; s.error = null; })
      .addCase(fetchCategories.fulfilled,(s, a) => { s.loading = false; s.categories = a.payload; })
      .addCase(fetchCategories.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // create
    builder
      .addCase(createCategoryThunk.pending,  (s) => { s.loading = true; })
      .addCase(createCategoryThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.categories.unshift(a.payload);
        s.successMessage = "Category created successfully";
      })
      .addCase(createCategoryThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // update
    builder
      .addCase(updateCategoryThunk.pending,  (s) => { s.loading = true; })
      .addCase(updateCategoryThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.categories = s.categories.map((c) => c._id === a.payload._id ? a.payload : c);
        s.successMessage = "Category updated successfully";
      })
      .addCase(updateCategoryThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // delete
    builder
      .addCase(deleteCategoryThunk.pending,  (s) => { s.loading = true; })
      .addCase(deleteCategoryThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.categories = s.categories.filter((c) => c._id !== a.payload);
        s.successMessage = "Category deleted successfully";
      })
      .addCase(deleteCategoryThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });
  },
});

export const { clearCategoryMessages } = categorySlice.actions;
export default categorySlice.reducer;
