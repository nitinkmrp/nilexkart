import { lazy, Suspense } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import Loader from "./components/Loader/Loader";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Existing pages
const Home    = lazy(() => import("./pages/Home"));
const Shop    = lazy(() => import("./pages/Shop"));
const Cart    = lazy(() => import("./pages/Cart"));
const Product = lazy(() => import("./pages/Product"));
const Payment = lazy(() => import("./pages/Payment"));

// New pages
const Profile      = lazy(() => import("./pages/Profile"));
const AdminUsers   = lazy(() => import("./pages/AdminUsers"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));

function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Router>
        <ToastContainer
          position="top-right"
          autoClose={2000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        <NavBar />
        <Routes>
          {/* Existing routes */}
          <Route path="/"           element={<Home />} />
          <Route path="/shop"       element={<Shop />} />
          <Route path="/shop/:id"   element={<Product />} />
          <Route path="/cart"       element={<Cart />} />
          <Route path="/payment"    element={<Payment />} />

          {/* New routes */}
          <Route path="/profile"            element={<Profile />} />
          <Route path="/admin/users"        element={<AdminUsers />} />
          <Route path="/admin/products"     element={<AdminProducts />} />
        </Routes>
        <Footer />
      </Router>
    </Suspense>
  );
}

export default App;
