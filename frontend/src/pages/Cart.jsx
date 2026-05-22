import { useEffect } from "react";
import { Col, Container, Row, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  addToCart,
  decreaseQty,
  deleteProduct,
} from "../app/features/cart/cartSlice";

const Cart = () => {
  const { cartList } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // middlware to localStorage
  const totalPrice = cartList.reduce(
    (price, item) => price + item.qty * item.price,
    0
  );
  useEffect(() => {
    window.scrollTo(0, 0);
    // if(CartItem.length ===0) {
    //   const storedCart = localStorage.getItem("cartItem");
    //   setCartItem(JSON.parse(storedCart));
    // }
  }, []);
  return (
    <section className="cart-items">
      <Container>
        <Row className="justify-content-center">
          <Col md={8}>
            {cartList.length === 0 && (
              <h1 className="no-items product">No Items are add in Cart</h1>
            )}
            {cartList.map((item) => {
              const productQty = item.price * item.qty;
              return (
                 <div className="cart-list" key={`${item.id}-${item.selectedSize || ''}`}>
                  <Row>
                    <Col className="image-holder" sm={4} md={3}>
                      <img src={item.imgUrl} alt="" />
                    </Col>
                    <Col sm={8} md={9}>
                      <Row className="cart-content justify-content-center">
                        <Col xs={12} sm={9} className="cart-details">
                          <h3>{item.productName}</h3>
                          {item.selectedSize && (
                            <p className="cart-size" style={{ fontSize: "14px", color: "#666", margin: "5px 0 10px 0" }}>
                              Size: <strong style={{ color: "#000", border: "1px solid #ccc", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>{item.selectedSize}</strong>
                            </p>
                          )}
                          <h4>
                            ₹{item.price}.00 * {item.qty}
                            <span>₹{productQty}.00</span>
                          </h4>
                        </Col>
                        <Col xs={12} sm={3} className="cartControl">
                          <button
                            className="incCart"
                            onClick={() =>
                              dispatch(addToCart({ product: item, num: 1 }))
                            }
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                          <button
                            className="desCart"
                            onClick={() => dispatch(decreaseQty(item))}
                          >
                            <i className="fa-solid fa-minus"></i>
                          </button>
                        </Col>
                      </Row>
                    </Col>
                    <button
                      className="delete"
                      onClick={() => dispatch(deleteProduct(item))}
                    >
                      <ion-icon name="close"></ion-icon>
                    </button>
                  </Row>
                </div>
              );
            })}
          </Col>
          <Col md={4}>
            <div className="cart-total">
              <h2>Cart Summary</h2>
              <div className=" d_flex">
                <h4>Total Price :</h4>
                <h3>₹{totalPrice}.00</h3>
              </div>
              <Button 
                variant="primary" 
                className="w-100 mt-3" 
                style={{ backgroundColor: "#0f3460", borderColor: "#0f3460" }}
                onClick={() => navigate("/payment")}
                disabled={cartList.length === 0}
              >
                Proceed to Checkout
              </Button>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Cart;
