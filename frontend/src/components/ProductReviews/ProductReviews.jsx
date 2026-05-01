import { useState } from "react";
import { Container } from "react-bootstrap";
import "./product-review.css";

const ProductReviews = ({ selectedProduct }) => {
  const [listSelected, setListSelected] = useState("desc");
  return (
    <section className="product-reviews">
      <Container>
        <ul>
          <li
            style={{ color: listSelected === "desc" ? "black" : "#9c9b9b" }}
            onClick={() => setListSelected("desc")}
          >
            Description
          </li>
          <li
            style={{ color: listSelected === "rev" ? "black" : "#9c9b9b" }}
            onClick={() => setListSelected("rev")}
          >
            Reviews ({selectedProduct?.reviews?.length || 0})
          </li>
        </ul>
        {listSelected === "desc" ? (
          <p>{selectedProduct?.description}</p>
        ) : (
          <div className="rates">
            {(selectedProduct?.reviews || []).map((rate, index) => (
              <div className="rate-comment" key={index}>
                <span>John Doe</span>
                <span>{rate.rating} (rating)</span>
                <p>{rate.text}</p>
              </div>
            ))}
            {(selectedProduct?.reviews?.length || 0) === 0 && (
              <p>No reviews yet for this product.</p>
            )}
          </div>
        )}
      </Container>
    </section>
  );
};

export default ProductReviews;
