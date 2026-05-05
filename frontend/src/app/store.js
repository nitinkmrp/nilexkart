import { configureStore } from "@reduxjs/toolkit";
import cartReducer, { cartMiddleware } from "./features/cart/cartSlice";
import userReducer from "./userSlice";
import categoryReducer from "./categorySlice";
import billReducer from "./billSlice";

export const store = configureStore({
  reducer: {
    cart:       cartReducer,
    users:      userReducer,
    categories: categoryReducer,
    bills:      billReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(cartMiddleware),
});
