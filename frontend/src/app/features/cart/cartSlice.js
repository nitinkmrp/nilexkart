import { createSlice } from "@reduxjs/toolkit";

const storedCartList =
  localStorage.getItem("cartList") !== null
    ? JSON.parse(localStorage.getItem("cartList"))
    : [];

const initialState = {
  cartList: storedCartList,
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const raw      = action.payload.product;
      const quantity = action.payload.num;
      // DB price is already the sale price — store mrp for cart display strikethrough
      const salePrice = raw.price || 0;
      const disc      = raw.discount || 0;
      const mrp       = disc > 0
        ? Math.round(salePrice / (1 - disc / 100))
        : salePrice;
      const productToAdd = { ...raw, mrp, price: salePrice };
      const productExit = state.cartList.find(
        (item) => item.id === productToAdd.id && item.selectedSize === productToAdd.selectedSize
      );
      if (productExit) {
        state.cartList = state.cartList.map((item) =>
          item.id === productToAdd.id && item.selectedSize === productToAdd.selectedSize
            ? { ...productExit, qty: productExit.qty + quantity }
            : item
        );
      } else {
        state.cartList.push({ ...productToAdd, qty: quantity });
      }
    },
    decreaseQty: (state, action) => {
      const productTodecreaseQnty = action.payload;
      const productExit = state.cartList.find(
        (item) => item.id === productTodecreaseQnty.id && item.selectedSize === productTodecreaseQnty.selectedSize
      );
      if (!productExit) return;
      if (productExit.qty === 1) {
        state.cartList = state.cartList.filter(
          (item) => !(item.id === productExit.id && item.selectedSize === productExit.selectedSize)
        );
      } else {
        state.cartList = state.cartList.map((item) =>
          item.id === productExit.id && item.selectedSize === productExit.selectedSize
            ? { ...productExit, qty: productExit.qty - 1 }
            : item
        );
      }
    },
    deleteProduct: (state, action) => {
      const productToDelete = action.payload;
      state.cartList = state.cartList.filter(
        (item) => !(item.id === productToDelete.id && item.selectedSize === productToDelete.selectedSize)
      );
    },
  },
});

export const cartMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  if (action.type?.startsWith("cart/")) {
    const cartList = store.getState().cart.cartList;
    localStorage.setItem("cartList", JSON.stringify(cartList));
  }
  return result;
};

export const { addToCart, decreaseQty, deleteProduct } = cartSlice.actions;

export default cartSlice.reducer;
