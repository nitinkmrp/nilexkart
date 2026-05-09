import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/userApi";

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchAllUsers = createAsyncThunk(
  "users/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.getAllUsers();
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message || "Failed to fetch users");
    }
  }
);

export const fetchUserByEmail = createAsyncThunk(
  "users/fetchOne",
  async (email, { rejectWithValue }) => {
    try {
      const data = await api.getUserByEmail(email);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message || "User not found");
    }
  }
);

export const registerUser = createAsyncThunk(
  "users/register",
  async (userData, { rejectWithValue }) => {
    try {
      const data = await api.createUser(userData);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message || "Failed to create user");
    }
  }
);

export const updateUserThunk = createAsyncThunk(
  "users/update",
  async ({ email, updates }, { rejectWithValue }) => {
    try {
      const data = await api.updateUser(email, updates);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message || "Failed to update user");
    }
  }
);

export const deleteUserThunk = createAsyncThunk(
  "users/delete",
  async (email, { rejectWithValue }) => {
    try {
      await api.deleteUser(email);
      return email; // return email to remove from state
    } catch (err) {
      return rejectWithValue(err.message || "Failed to delete user");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const userSlice = createSlice({
  name: "users",
  initialState: {
    // Auth / Profile
    currentUser: JSON.parse(localStorage.getItem("currentUser")) || null,
    isLoggedIn: !!localStorage.getItem("currentUser"),

    // Users list (admin)
    users: [],
    selectedUser: null,

    // Async state
    loading: false,
    error: null,
    successMessage: null,
  },
  reducers: {
    loginUser(state, action) {
      state.currentUser = action.payload;
      state.isLoggedIn = true;
      localStorage.setItem("currentUser", JSON.stringify(action.payload));
    },
    logoutUser(state) {
      state.currentUser = null;
      state.isLoggedIn = false;
      localStorage.removeItem("currentUser");
      localStorage.removeItem("jwtToken");
    },
    clearMessages(state) {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // ── Fetch All ──
    builder
      .addCase(fetchAllUsers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAllUsers.fulfilled, (state, action) => { state.loading = false; state.users = action.payload; })
      .addCase(fetchAllUsers.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

    // ── Fetch One ──
      .addCase(fetchUserByEmail.pending, (state) => { state.loading = true; })
      .addCase(fetchUserByEmail.fulfilled, (state, action) => { state.loading = false; state.selectedUser = action.payload; })
      .addCase(fetchUserByEmail.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

    // ── Register ──
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users.unshift(action.payload);
        state.successMessage = "User registered successfully!";
      })
      .addCase(registerUser.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

    // ── Update ──
      .addCase(updateUserThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateUserThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = "User updated successfully!";
        const idx = state.users.findIndex(u => u.email === action.payload.email);
        if (idx !== -1) state.users[idx] = action.payload;
        // Update currentUser if they updated their own profile
        if (state.currentUser?.email === action.payload.email) {
          state.currentUser = action.payload;
          localStorage.setItem("currentUser", JSON.stringify(action.payload));
        }
      })
      .addCase(updateUserThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

    // ── Delete ──
      .addCase(deleteUserThunk.pending, (state) => { state.loading = true; })
      .addCase(deleteUserThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(u => u.email !== action.payload);
        state.successMessage = "User deleted successfully!";
      })
      .addCase(deleteUserThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { loginUser, logoutUser, clearMessages } = userSlice.actions;
export default userSlice.reducer;
