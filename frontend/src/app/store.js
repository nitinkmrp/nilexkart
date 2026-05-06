import { configureStore } from "@reduxjs/toolkit";
import cartReducer, { cartMiddleware } from "./features/cart/cartSlice";
import userReducer from "./userSlice";
import categoryReducer from "./categorySlice";
import billReducer from "./billSlice";
import customerReducer from "./customerSlice";

export const store = configureStore({
  reducer: {
    cart:       cartReducer,
    users:      userReducer,
    categories: categoryReducer,
    bills:      billReducer,
    customers:  customerReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(cartMiddleware),
});
