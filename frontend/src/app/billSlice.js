import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const BASE      = process.env.REACT_APP_API_URL  || "https://final-project1-d3iz.onrender.com";
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY || "";

async function adminFetch(path, opts = {}) {
  const res  = await fetch(`${BASE}${path}`, {
    headers: { "x-admin-key": ADMIN_KEY, ...opts.headers },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

// ── Thunks ────────────────────────────────────────────
export const fetchBills = createAsyncThunk("bills/fetchAll", async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const data = await adminFetch(`/api/bills${qs ? "?" + qs : ""}`);
  return { bills: data.data, totalRevenue: data.totalRevenue };
});

export const createBillThunk = createAsyncThunk(
  "bills/create",
  async (formData, { rejectWithValue }) => {
    try {
      const res  = await fetch(`${BASE}/api/bills`, {
        method: "POST",
        headers: { "x-admin-key": ADMIN_KEY },
        body: formData,  // FormData (supports file upload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      return json.data;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

export const updateBillThunk = createAsyncThunk(
  "bills/update",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const res  = await fetch(`${BASE}/api/bills/${id}`, {
        method: "PUT",
        headers: { "x-admin-key": ADMIN_KEY },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      return json.data;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

export const authorizeCashThunk = createAsyncThunk(
  "bills/authorize",
  async ({ id, authorizedBy, authorize }, { rejectWithValue }) => {
    try {
      const data = await adminFetch(`/api/bills/${id}/authorize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
        body: JSON.stringify({ authorizedBy, authorize }),
      });
      return data.data;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

export const deleteBillThunk = createAsyncThunk(
  "bills/delete",
  async (id, { rejectWithValue }) => {
    try {
      await adminFetch(`/api/bills/${id}`, { method: "DELETE" });
      return id;
    } catch (err) { return rejectWithValue(err.message); }
  }
);

// ── Slice ─────────────────────────────────────────────
const billSlice = createSlice({
  name: "bills",
  initialState: {
    bills:        [],
    totalRevenue: 0,
    loading:      false,
    error:        null,
    successMsg:   null,
  },
  reducers: {
    clearBillMessages(state) {
      state.error      = null;
      state.successMsg = null;
    },
  },
  extraReducers: (builder) => {
    // fetch
    builder
      .addCase(fetchBills.pending,  (s) => { s.loading = true; s.error = null; })
      .addCase(fetchBills.fulfilled,(s, a) => {
        s.loading = false;
        s.bills   = a.payload.bills;
        s.totalRevenue = a.payload.totalRevenue || 0;
      })
      .addCase(fetchBills.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // create
    builder
      .addCase(createBillThunk.pending,  (s) => { s.loading = true; })
      .addCase(createBillThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.bills.unshift(a.payload);
        s.totalRevenue += a.payload.amount;
        s.successMsg = "Bill created successfully";
      })
      .addCase(createBillThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // update
    builder
      .addCase(updateBillThunk.pending,  (s) => { s.loading = true; })
      .addCase(updateBillThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.bills   = s.bills.map((b) => b._id === a.payload._id ? a.payload : b);
        s.successMsg = "Bill updated successfully";
      })
      .addCase(updateBillThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // authorize
    builder
      .addCase(authorizeCashThunk.pending,  (s) => { s.loading = true; })
      .addCase(authorizeCashThunk.fulfilled,(s, a) => {
        s.loading = false;
        s.bills   = s.bills.map((b) => b._id === a.payload._id ? a.payload : b);
        s.successMsg = a.payload.cashAuthorized ? "Cash payment authorized ✅" : "Authorization revoked";
      })
      .addCase(authorizeCashThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // delete
    builder
      .addCase(deleteBillThunk.pending,  (s) => { s.loading = true; })
      .addCase(deleteBillThunk.fulfilled,(s, a) => {
        s.loading = false;
        const removed = s.bills.find((b) => b._id === a.payload);
        if (removed) s.totalRevenue -= removed.amount;
        s.bills   = s.bills.filter((b) => b._id !== a.payload);
        s.successMsg = "Bill deleted";
      })
      .addCase(deleteBillThunk.rejected, (s, a) => { s.loading = false; s.error = a.payload; });
  },
});

export const { clearBillMessages } = billSlice.actions;
export default billSlice.reducer;
