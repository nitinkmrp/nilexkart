import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { addToCart } from "../../app/features/cart/cartSlice";
import "./product-details.css";

/* ══════════════════════════════════════
   Flipkart-style Image Zoom Component
   ══════════════════════════════════════ */
const ZOOM = 2.5;

const ImageZoom = ({ src, alt, badge }) => {
  const [active, setActive] = useState(false);
  const [ready, setReady]   = useState(false); // true once image has loaded
  const [pos, setPos]       = useState({ x: 50, y: 50 });
  const wrapRef = useRef(null); // ref on the wrapper div, always mounted

  // Reset ready state when src changes
  useEffect(() => { setReady(false); setActive(false); }, [src]);

  const handleMove = useCallback((e) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left)  / rect.width)  * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top)   / rect.height) * 100));
    setPos({ x, y });
  }, []);

  const handleEnter = () => { if (ready) setActive(true); };
  const handleLeave = () => setActive(false);

  return (
    <>
      {/* ── Source image with lens ── */}
      <div
        ref={wrapRef}
        className={`zoom-source ${active ? "zooming" : ""}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseMove={handleMove}
      >
        <img
          src={src}
          alt={alt}
          className="pdp-main-image"
          loading="lazy"
          draggable={false}
          onLoad={() => setReady(true)}
        />

        {/* Lens square — only when zooming */}
        {active && (
          <div
            className="zoom-lens"
            style={{
              left: `calc(${pos.x}% - 55px)`,
              top:  `calc(${pos.y}% - 55px)`,
            }}
          />
        )}

        {badge && <span className="pdp-sale-badge">SALE</span>}
      </div>

      {/* ── Zoomed result panel ── */}
      {active && (
        <div
          className="zoom-result"
          style={{
            backgroundImage:    `url(${src})`,
            backgroundSize:     `${ZOOM * 100}%`,
            backgroundPosition: `${pos.x}% ${pos.y}%`,
            backgroundRepeat:   "no-repeat",
          }}
        />
      )}
    </>
  );
};

/* ══════════════════════════════════════
   Main ProductDetails Component
   ══════════════════════════════════════ */
const ProductDetails = ({ selectedProduct }) => {
  const dispatch = useDispatch();

  const sizes = selectedProduct?.sizes && selectedProduct.sizes.length > 0
    ? selectedProduct.sizes
    : [];
  const hasSizes = sizes.length > 0;

  const [selectedSize, setSelectedSize] = useState("");

  useEffect(() => {
    setSelectedSize("");
  }, [selectedProduct]);

  const handelAdd = () => {
    if (!selectedSize) {
      toast.error("Please select a size!");
      return;
    }
    const productId = selectedProduct._id || selectedProduct.id;
    dispatch(
      addToCart({
        product: { ...selectedProduct, id: productId, selectedSize },
        num: 1,
      })
    );
    toast.success("Added to cart! 🛍️");
  };

  const hasDiscount   = selectedProduct?.discount > 0;
  const originalPrice = hasDiscount
    ? Math.round(selectedProduct.price / (1 - selectedProduct.discount / 100))
    : null;

  return (
    <section className="pdp-wrapper">

      {/* ── Left: zoomable image ── */}
      <div className="pdp-image-col">
        <ImageZoom
          src={selectedProduct?.imgUrl || ""}
          alt={selectedProduct?.productName}
          badge={hasDiscount}
        />
      </div>

      {/* ── Right: info panel ── */}
      <div className="pdp-info-col">

        <p className="pdp-category">
          {selectedProduct?.category?.toUpperCase() || ""}
        </p>

        <h1 className="pdp-title">{selectedProduct?.productName}</h1>

        {/* Rating */}
        <div className="pdp-rating-row">
          <div className="pdp-stars">
            {[1,2,3,4,5].map((s) => (
              <svg key={s} className="pdp-star-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="pdp-rating-text">
            {selectedProduct?.avgRating} &nbsp;
            ({selectedProduct?.avgRating ? `${selectedProduct.avgRating}/5` : "No ratings"})
          </span>
        </div>

        {/* Price */}
        <div className="pdp-price-row">
          <span className="pdp-sale-price">
            ₹ {selectedProduct?.price?.toLocaleString("en-IN")}.00
          </span>
          {hasDiscount && (
            <>
              <span className="pdp-original-price">
                ₹ {originalPrice?.toLocaleString("en-IN")}.00
              </span>
              <span className="pdp-discount-badge">
                {selectedProduct.discount}% OFF
              </span>
            </>
          )}
        </div>
        {hasDiscount && (
          <p className="pdp-price-note">
            Inclusive of all taxes · Free shipping on orders above ₹999
          </p>
        )}

        <div className="pdp-divider" />

        {/* Size selector */}
        {hasSizes ? (
          <div className="pdp-size-section">
            <div className="pdp-size-header">
              <span className="pdp-size-label">
                SELECT SIZE
                {selectedSize && (
                  <span className="pdp-selected-size-display"> — {selectedSize}</span>
                )}
              </span>
            </div>
            {!selectedSize && (
              <p className="pdp-size-hint">Please select a size to add to cart</p>
            )}
            <div className="pdp-size-grid">
              {sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`pdp-size-btn ${selectedSize === sz ? "selected" : ""}`}
                  onClick={() => setSelectedSize(sz)}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pdp-size-section">
            <span className="pdp-size-label" style={{ color: "#999" }}>ONE SIZE FITS ALL</span>
          </div>
        )}

        {/* Add to Cart */}
        {hasSizes ? (
          <button
            className={`pdp-add-btn ${!selectedSize ? "disabled" : ""}`}
            onClick={() => handelAdd(selectedSize)}
            type="button"
          >
            {selectedSize ? `ADD TO CART — ${selectedSize}` : "SELECT A SIZE"}
          </button>
        ) : (
          <button
            className="pdp-add-btn"
            onClick={() => handelAdd(null)}
            type="button"
          >
            ADD TO CART
          </button>
        )}

        {/* Trust badges */}
        <div className="pdp-badges">
          <div className="pdp-badge-item">
            <span className="pdp-badge-icon">🚚</span>
            <span>Fast Shipping</span>
          </div>
          <div className="pdp-badge-item">
            <span className="pdp-badge-icon">↩️</span>
            <span>7 Days Easy Return</span>
          </div>
          <div className="pdp-badge-item">
            <span className="pdp-badge-icon">✅</span>
            <span>Secure Checkout</span>
          </div>
        </div>

        <div className="pdp-divider" />

        {selectedProduct?.shortDesc && (
          <p className="pdp-short-desc">{selectedProduct.shortDesc}</p>
        )}

        <ProductAccordion title="PRODUCT DETAILS">
          <ul className="pdp-details-list">
            <li>Category: {selectedProduct?.category}</li>
            {selectedProduct?.description ? (
              <li>{selectedProduct.description}</li>
            ) : (
              <>
                <li>Premium quality fabric</li>
                <li>Made with ♥️ in India</li>
              </>
            )}
          </ul>
        </ProductAccordion>

        <ProductAccordion title="SHIPPING & RETURNS">
          <ul className="pdp-details-list">
            <li>Ships within 24 hours</li>
            <li>Delivered in 3–6 business days</li>
            <li>7 days easy return & exchange</li>
          </ul>
        </ProductAccordion>
      </div>
    </section>
  );
};

/* ── Accordion ── */
const ProductAccordion = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="pdp-accordion">
      <button
        className="pdp-accordion-header"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span>{title}</span>
        <span className={`pdp-accordion-arrow ${open ? "open" : ""}`}>▼</span>
      </button>
      {open && <div className="pdp-accordion-body">{children}</div>}
    </div>
  );
};

export default ProductDetails;
