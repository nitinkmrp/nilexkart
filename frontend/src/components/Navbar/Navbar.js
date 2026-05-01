import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../../app/userSlice";
import { toast } from "react-toastify";
import LoginModal from "../LoginModal/LoginModal";
import "./Navbar.css";

const NavBar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoggedIn, currentUser } = useSelector((s) => s.users);
  const cartItems = useSelector((s) => s.cart?.cartItems || []);

  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const totalItems = cartItems.reduce((acc, i) => acc + i.qty, 0);

  const handleLogout = () => {
    dispatch(logoutUser());
    toast.success("Logged out successfully");
    navigate("/");
  };

  const initials = (name) =>
    name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light shadow-sm sticky-top bg-white">
        <div className="container">
          {/* Brand */}
          <Link className="navbar-brand fw-bold" to="/" style={{ color: "#0f3460", fontSize: 22 }}>
            🛍 ShopEase
          </Link>

          {/* Mobile toggler */}
          <button
            className="navbar-toggler"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Links */}
          <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link" to="/" onClick={() => setMenuOpen(false)}>Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
              </li>
              {isLoggedIn && currentUser?.role === "admin" && (
                <li className="nav-item">
                  <Link className="nav-link" to="/admin/users" onClick={() => setMenuOpen(false)}>
                    Users
                  </Link>
                </li>
              )}
            </ul>

            {/* Right side */}
            <div className="d-flex align-items-center gap-3">
              {/* Cart */}
              <Link to="/cart" className="position-relative" style={{ color: "#0f3460" }}>
                <i className="fa fa-shopping-cart fa-lg" />
                {totalItems > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {totalItems}
                  </span>
                )}
              </Link>

              {/* Auth */}
              {isLoggedIn ? (
                <Dropdown align="end">
                  <Dropdown.Toggle 
                    variant="link" 
                    className="d-flex align-items-center gap-2 p-0 border-0 text-decoration-none" 
                    id="profile-dropdown"
                  >
                    <div className="nav-avatar">{initials(currentUser?.name)}</div>
                    <span className="d-none d-md-inline fw-semibold" style={{ fontSize: 14, color: "#0f3460" }}>
                      {currentUser?.name?.split(" ")[0]}
                    </span>
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="shadow border-0 mt-2">
                    <Dropdown.Item as={Link} to="/profile">
                      <i className="fa fa-user me-2" /> My Profile
                    </Dropdown.Item>
                    {currentUser?.role === "admin" && (
                      <Dropdown.Item as={Link} to="/admin/users">
                        <i className="fa fa-users me-2" /> Manage Users
                      </Dropdown.Item>
                    )}
                    <Dropdown.Divider />
                    <Dropdown.Item className="text-danger" onClick={handleLogout}>
                      <i className="fa fa-sign-out me-2" /> Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <button
                  className="btn btn-primary btn-sm px-3"
                  style={{ background: "#0f3460", border: "none" }}
                  onClick={() => setShowLogin(true)}
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Login Modal */}
      <LoginModal show={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
};

export default NavBar;
