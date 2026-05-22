import { Col } from "react-bootstrap";
import "./product-card.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../app/features/cart/cartSlice";
import { useState, useEffect } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const DEFAULT_SIZES = []; // No defaults — only show what admin set
const ONE_SIZE_LABEL = "ONE SIZE";

const ProductCard = ({ title, productItem }) => {
  const dispatch  = useDispatch();
  const router    = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);

  const [wishlisted, setWishlisted] = useState(false);
  const [wlLoading,  setWlLoading]  = useState(false);
  const [addedSize,  setAddedSize]  = useState(""); // flash feedback

  const pId    = productItem._id || productItem.id;
  const sizes = productItem.sizes && productItem.sizes.length > 0
    ? productItem.sizes
    : [];
  const hasNoSizes = sizes.length === 0;

  const hasDiscount   = productItem.discount > 0;
  const originalPrice = hasDiscount
    ? Math.round(productItem.price / (1 - productItem.discount / 100))
    : null;

  /* ── waitlist check on mount ── */
  useEffect(() => {
    if (!currentUser) { setWishlisted(false); return; }
    fetch(`${BASE_URL}/api/waitlist/${encodeURIComponent(currentUser.email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setWishlisted(data.data.some(i => String(i.productId) === String(pId)));
        }
      })
      .catch(() => {});
  }, [currentUser, pId]);

  /* ── navigate to detail ── */
  const handleClick = () => router(`/shop/${pId}`);

  /* ── add to cart with chosen size ── */
  const handleSizeAdd = (e, sz) => {
    e.stopPropagation();
    dispatch(addToCart({
      product: { ...productItem, id: pId, selectedSize: sz },
      num: 1,
    }));
    setAddedSize(sz);
    toast.success(`Added ${sz} to cart! 🛍️`);
    setTimeout(() => setAddedSize(""), 1500);
  };

  /* ── waitlist toggle ── */
  const handleWaitlist = async (e) => {
    e.stopPropagation();
    if (!currentUser) { toast.info("Please log in to use the waitlist."); return; }
    setWlLoading(true);
    try {
      if (wishlisted) {
        const res  = await fetch(
          `${BASE_URL}/api/waitlist/${encodeURIComponent(currentUser.email)}/${encodeURIComponent(pId)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (data.success) { setWishlisted(false); toast.info("Removed from waitlist."); }
        else toast.error(data.message || "Could not remove.");
      } else {
        const res  = await fetch(`${BASE_URL}/api/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail:    currentUser.email,
            productId:    String(pId),
            productName:  productItem.productName,
            productImage: productItem.imgUrl || "",
            price:        productItem.price   || 0,
            status:       "Out of Stock",
          }),
        });
        const data = await res.json();
        if (data.success)      { setWishlisted(true); toast.success("Added to waitlist! 🔔"); }
        else if (res.status === 409) { setWishlisted(true); toast.info("Already in your waitlist."); }
        else toast.error(data.message || "Could not add to waitlist.");
      }
    } catch { toast.error("Network error. Please try again."); }
    finally { setWlLoading(false); }
  };

  return (
    <Col md={3} sm={5} xs={10} className="product mtop">

      {/* Discount badge */}
      {hasDiscount && (
        <span className="discount">{productItem.discount}% Off</span>
      )}

      {/* Waitlist heart */}
      <button
        className={`product-waitlist-btn ${wishlisted ? "wishlisted" : ""}`}
        onClick={handleWaitlist}
        disabled={wlLoading}
        title={wishlisted ? "Remove from Waitlist" : "Add to Waitlist"}
        aria-label="Waitlist"
      >
        {wlLoading ? "⏳" : wishlisted ? "🔖" : "🏷️"}
      </button>

      {/* Image */}
      <div className="product-img-wrapper" onClick={handleClick}>
        <img
          loading="lazy"
          src={productItem.imgUrl || ""}
          alt={productItem.productName}
        />

        {/* ── Size overlay — slides up on hover ── */}
        <div className="pc-size-overlay">
          {hasNoSizes ? (
            <>
              <p className="pc-size-label">ONE SIZE</p>
              <button
                type="button"
                className={`pc-size-btn ${addedSize === ONE_SIZE_LABEL ? "pc-size-added" : ""}`}
                onClick={(e) => handleSizeAdd(e, ONE_SIZE_LABEL)}
              >
                {addedSize === ONE_SIZE_LABEL ? "✓ Added" : "ADD TO CART"}
              </button>
            </>
          ) : (
            <>
              <p className="pc-size-label">SELECT SIZE</p>
              <div className="pc-size-row">
                {sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`pc-size-btn ${addedSize === sz ? "pc-size-added" : ""}`}
                    onClick={(e) => handleSizeAdd(e, sz)}
                    title={`Add ${sz} to cart`}
                  >
                    {addedSize === sz ? "✓" : sz}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="product-details">
        <h3 onClick={handleClick}>{productItem.productName}</h3>

        <div className="price">
          <div className="price-info">
            <h4>₹{productItem.price}</h4>
            {hasDiscount && (
              <span className="original-price-card">₹{originalPrice}</span>
            )}
          </div>
          {/* "View" link replaces the old + button */}
          <button
            aria-label="View product"
            type="button"
            className="view-btn"
            onClick={handleClick}
            title="View details"
          >
            →
          </button>
        </div>
      </div>
    </Col>
  );
};

export default ProductCard;
