import { Col } from "react-bootstrap";
import "./product-card.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../app/features/cart/cartSlice";
import { useState, useEffect } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const ProductCard = ({ title, productItem }) => {
  const dispatch = useDispatch();
  const router = useNavigate();
  const currentUser = useSelector((s) => s.users.currentUser);
  const [wishlisted, setWishlisted] = useState(false);
  const [wlLoading, setWlLoading] = useState(false);

  const pId = productItem._id || productItem.id;

  // Check if this product is already in the user's waitlist on mount
  useEffect(() => {
    if (!currentUser) { setWishlisted(false); return; }
    fetch(`${BASE_URL}/api/waitlist/${encodeURIComponent(currentUser.email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const found = data.data.some(
            (item) => String(item.productId) === String(pId)
          );
          setWishlisted(found);
        }
      })
      .catch(() => {});
  }, [currentUser, pId]);

  const handelClick = () => {
    router(`/shop/${pId}`);
  };

  const handelAdd = (productItem) => {
    dispatch(addToCart({ product: productItem, num: 1 }));
    toast.success("Product has been added to cart!");
  };

  const handleWaitlist = async (e) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info("Please log in to use the waitlist.");
      return;
    }
    setWlLoading(true);
    try {
      if (wishlisted) {
        // Remove from waitlist
        const res = await fetch(
          `${BASE_URL}/api/waitlist/${encodeURIComponent(currentUser.email)}/${encodeURIComponent(pId)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (data.success) {
          setWishlisted(false);
          toast.info("Removed from waitlist.");
        } else {
          toast.error(data.message || "Could not remove.");
        }
      } else {
        // Add to waitlist
        const res = await fetch(`${BASE_URL}/api/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: currentUser.email,
            productId: String(pId),
            productName: productItem.productName,
            productImage: productItem.imgUrl || "",
            price: productItem.price || 0,
            status: "Out of Stock",
          }),
        });
        const data = await res.json();
        if (data.success) {
          setWishlisted(true);
          toast.success("Added to waitlist! We'll notify you when it's back. 🔔");
        } else if (res.status === 409) {
          setWishlisted(true);
          toast.info("Already in your waitlist.");
        } else {
          toast.error(data.message || "Could not add to waitlist.");
        }
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setWlLoading(false);
    }
  };
  return (
    <Col md={3} sm={5} xs={10} className="product mtop">
      {title === "Big Discount" ? (
        <span className="discount">{productItem.discount}% Off</span>
      ) : null}
      <img
        loading="lazy"
        onClick={() => handelClick()}
        src={productItem.imgUrl && productItem.imgUrl.startsWith("/uploads/") 
          ? `${BASE_URL}${productItem.imgUrl}` 
          : productItem.imgUrl}
        alt={productItem.productName}
      />
      <button
        className={`product-waitlist-btn ${wishlisted ? "wishlisted" : ""}`}
        onClick={handleWaitlist}
        disabled={wlLoading}
        title={wishlisted ? "Remove from Waitlist" : "Add to Waitlist"}
        aria-label="Waitlist"
      >
        {wlLoading ? "⏳" : wishlisted ? "🔖" : "🏷️"}
      </button>
      <div className="product-details">
        <h3 onClick={() => handelClick()}>{productItem.productName}</h3>
        <div className="rate">
          <i className="fa fa-star"></i>
          <i className="fa fa-star"></i>
          <i className="fa fa-star"></i>
          <i className="fa fa-star"></i>
          <i className="fa fa-star"></i>
        </div>
        <div className="price">
          <h4>₹{productItem.price}</h4>
          <button
            aria-label="Add"
            type="submit"
            className="add"
            onClick={() => handelAdd(productItem)}
          >
            <ion-icon name="add"></ion-icon>
          </button>
        </div>
      </div>
    </Col>
  );
};

export default ProductCard;
