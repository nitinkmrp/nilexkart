import { useEffect, useState } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { addToCart, decreaseQty, deleteProduct } from "../app/features/cart/cartSlice";

const Payment = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { cartList } = useSelector((state) => state.cart);
  const { currentUser } = useSelector((state) => state.users);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalPrice = cartList.reduce(
    (price, item) => price + item.qty * item.price,
    0
  );

  useEffect(() => {
    // Load Razorpay script only once
    if (!document.getElementById('razorpay-sdk')) {
      const script = document.createElement("script");
      script.id  = 'razorpay-sdk';
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload  = () => setScriptLoaded(true);
      script.onerror = () => toast.error("Failed to load Razorpay SDK");
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true); // already loaded
    }
  }, []); // run once on mount only

  useEffect(() => {
    if (!currentUser) {
      toast.info("Please login to proceed with payment.");
      navigate("/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (cartList.length === 0) {
      toast.info("Your cart is empty. Redirecting to shop.");
      navigate("/shop");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only check on mount — not on every cart change


  const handlePayment = async () => {
    if (!scriptLoaded) {
      toast.error("Razorpay SDK failed to load. Are you online?");
      return;
    }

    setLoading(true);

    try {
      // 1. Create order on our backend
      const baseUrl = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";
      const orderRes = await fetch(`${baseUrl}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalPrice, currency: "INR" }),
      });

      const orderData = await orderRes.json();

      if (!orderData.success) {
        throw new Error(orderData.message || "Failed to create order");
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || "YOUR_RAZORPAY_KEY_ID", // Enter the Key ID generated from the Dashboard
        amount: orderData.order.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.order.currency,
        name: "Ecommerce Store",
        description: "Test Transaction",
        order_id: orderData.order.id, // This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response) {
          // 3. Verify payment signature on backend
          try {
            const verifyRes = await fetch(`${baseUrl}/api/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: currentUser.email,
                items: cartList,
                amount: totalPrice
              }),
            });
            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              toast.success("Payment Successful!");
              // Clear cart and redirect to profile/orders
              cartList.forEach(item => dispatch(deleteProduct(item)));
              navigate("/profile");
            } else {
              toast.error("Payment Verification Failed!");
            }
          } catch (err) {
            toast.error("Server error during verification");
          }
        },
        prefill: {
          name: currentUser?.name || "Customer",
          email: currentUser?.email || "customer@example.com",
          contact: "9999999999",
        },
        notes: {
          address: "Ecommerce Corporate Office",
        },
        theme: {
          color: "#0f3460",
        },
      };

      const rzp1 = new window.Razorpay(options);
      
      rzp1.on("payment.failed", function (response) {
        toast.error(`Payment Failed: ${response.error.description}`);
      });

      rzp1.open();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="payment-page py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={6}>
            <Card className="shadow-sm border-0 rounded-4">
              <Card.Body className="p-4">
                <h3 className="mb-4 text-center" style={{ color: "#0f3460" }}>Checkout via Razorpay</h3>
                
                <div className="order-summary mb-4 p-3 bg-light rounded">
                  <h5 className="mb-3">Order Summary</h5>
                  {cartList.map((item) => (
                    <div key={`${item.id || item._id}-${item.selectedSize || 'os'}`} className="d-flex justify-content-between mb-2">
                      <span>{item.productName} {item.selectedSize ? `(${item.selectedSize})` : ''} × {item.qty}</span>
                      <span>₹{item.price * item.qty}.00</span>
                    </div>
                  ))}

                  <hr />
                  <div className="d-flex justify-content-between fw-bold fs-5">
                    <span>Total Amount:</span>
                    <span>₹{totalPrice}.00</span>
                  </div>
                  <small className="text-muted d-block mt-2 text-center">
                    (Note: Razorpay charges in paise, so this will be charged as ₹{totalPrice}.00)
                  </small>
                </div>

                <div className="d-grid gap-2">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    style={{ backgroundColor: "#0f3460", borderColor: "#0f3460" }}
                    onClick={handlePayment}
                    disabled={loading || cartList.length === 0}
                  >
                    {loading ? "Processing..." : `Pay Now (₹${totalPrice}.00)`}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => navigate("/cart")}>
                    Back to Cart
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Payment;
