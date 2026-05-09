import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API = process.env.REACT_APP_API_URL || "http://localhost:8888";
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY || "";

const headers = () => {
  const token = localStorage.getItem("jwtToken");
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
};

// ── Thunks ────────────────────────────────────────────

export const fetchCustomers = createAsyncThunk(
  "customers/fetchAll",
  async (search = "", { rejectWithValue }) => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${API}/api/customers${q}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch customers");
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchCustomerTimeline = createAsyncThunk(
  "customers/fetchTimeline",
  async (id, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/api/customers/${id}/timeline`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch timeline");
      return data.data; // { customer, bills, totalSpend }
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createCustomerThunk = createAsyncThunk(
  "customers/create",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/api/customers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create customer");
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateCustomerThunk = createAsyncThunk(
  "customers/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/api/customers/${id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update customer");
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteCustomerThunk = createAsyncThunk(
  "customers/delete",
  async (id, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/api/customers/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete customer");
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Slice ────────────────────────────────────────────
const customerSlice = createSlice({
  name: "customers",
  initialState: {
    customers:  [],
    timeline:   null,   // { customer, bills, totalSpend }
    loading:    false,
    tlLoading:  false,
    error:      null,
    successMsg: null,
  },
  reducers: {
    clearCustomerMessages(state) {
      state.error      = null;
      state.successMsg = null;
    },
    clearTimeline(state) {
      state.timeline = null;
    },
  },
  extraReducers: (builder) => {
    // fetchCustomers
    builder
      .addCase(fetchCustomers.pending,  (s) => { s.loading = true; s.error = null; })
      .addCase(fetchCustomers.fulfilled,(s, a) => { s.loading = false; s.customers = a.payload.data; })
      .addCase(fetchCustomers.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // fetchTimeline
    builder
      .addCase(fetchCustomerTimeline.pending,  (s) => { s.tlLoading = true; s.error = null; })
      .addCase(fetchCustomerTimeline.fulfilled,(s, a) => { s.tlLoading = false; s.timeline = a.payload; })
      .addCase(fetchCustomerTimeline.rejected, (s, a) => { s.tlLoading = false; s.error = a.payload; });

    // create
    builder
      .addCase(createCustomerThunk.fulfilled, (s, a) => {
        s.customers.unshift(a.payload);
        s.successMsg = "Customer created successfully!";
      })
      .addCase(createCustomerThunk.rejected, (s, a) => { s.error = a.payload; });

    // update
    builder
      .addCase(updateCustomerThunk.fulfilled, (s, a) => {
        const idx = s.customers.findIndex((c) => c._id === a.payload._id);
        if (idx !== -1) s.customers[idx] = { ...s.customers[idx], ...a.payload };
        s.successMsg = "Customer updated!";
      })
      .addCase(updateCustomerThunk.rejected, (s, a) => { s.error = a.payload; });

    // delete
    builder
      .addCase(deleteCustomerThunk.fulfilled, (s, a) => {
        s.customers = s.customers.filter((c) => c._id !== a.payload);
        s.successMsg = "Customer deleted";
      })
      .addCase(deleteCustomerThunk.rejected, (s, a) => { s.error = a.payload; });
  },
});

export const { clearCustomerMessages, clearTimeline } = customerSlice.actions;
export default customerSlice.reducer;
