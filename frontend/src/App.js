import { lazy, Suspense } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/Navbar/Navbar";
import Footer from "./components/Footer/Footer";
import Loader from "./components/Loader/Loader";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminGuard from "./components/AdminGuard";

// Existing pages
const Home    = lazy(() => import("./pages/Home"));
const Shop    = lazy(() => import("./pages/Shop"));
const Cart    = lazy(() => import("./pages/Cart"));
const Product = lazy(() => import("./pages/Product"));
const Payment = lazy(() => import("./pages/Payment"));

// New pages
const Profile      = lazy(() => import("./pages/Profile"));
const AdminUsers   = lazy(() => import("./pages/AdminUsers"));
const AdminProducts    = lazy(() => import("./pages/AdminProducts"));
const AdminCategories  = lazy(() => import("./pages/AdminCategories"));
const AdminBills       = lazy(() => import("./pages/AdminBills"));
const AdminCustomers   = lazy(() => import("./pages/AdminCustomers"));

// Policy Pages
const PrivacyPolicy  = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy   = lazy(() => import("./pages/RefundPolicy"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const TermsCondition = lazy(() => import("./pages/TermsCondition"));

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
          <Route path="/admin/users"        element={<AdminGuard allowedRoles={['admin']}><AdminUsers /></AdminGuard>} />
          <Route path="/admin/products"     element={<AdminGuard allowedRoles={['admin', 'editor']}><AdminProducts /></AdminGuard>} />
          <Route path="/admin/categories"   element={<AdminGuard allowedRoles={['admin', 'editor']}><AdminCategories /></AdminGuard>} />
          <Route path="/admin/bills"        element={<AdminGuard allowedRoles={['admin', 'editor', 'support']}><AdminBills /></AdminGuard>} />
          <Route path="/admin/customers"    element={<AdminGuard allowedRoles={['admin', 'editor', 'support']}><AdminCustomers /></AdminGuard>} />

          {/* Policy Routes */}
          <Route path="/privacy-policy"         element={<PrivacyPolicy />} />
          <Route path="/refund-policy"          element={<RefundPolicy />} />
          <Route path="/shipping-policy"        element={<ShippingPolicy />} />
          <Route path="/terms-and-conditions"   element={<TermsCondition />} />
        </Routes>
        <Footer />
      </Router>
    </Suspense>
  );
}

export default App;
