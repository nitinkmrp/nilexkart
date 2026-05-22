import { Fragment, useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { useParams } from "react-router-dom";
import ProductDetails from "../components/ProductDetails/ProductDetails";
import ProductReviews from "../components/ProductReviews/ProductReviews";
import ShopList from "../components/ShopList";
import useWindowScrollToTop from "../hooks/useWindowScrollToTop";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const Product = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    // Sanitize ID to prevent URL artifacts from breaking the API request
    const cleanId = id.split('?')[0].replace(/[^a-zA-Z0-9]/g, '');

    setLoading(true);
    fetch(`${BASE_URL}/api/products/${cleanId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProduct(data.data);
          return fetch(`${BASE_URL}/api/products?category=${data.data.category}`);
        }
      })
      .then((res) => res && res.json())
      .then((data) => {
        if (data && data.success) {
          setRelatedProducts(data.data.filter((p) => p._id !== cleanId));
        }
      })
      .catch((err) => console.error("Error fetching product details:", err))
      .finally(() => setLoading(false));
  }, [id]);

  useWindowScrollToTop();

  if (loading)
    return (
      <div className="text-center py-5" style={{ paddingTop: "120px" }}>
        <div className="spinner-border" style={{ color: "#111" }} />
      </div>
    );

  if (!product)
    return (
      <div className="text-center py-5" style={{ paddingTop: "120px" }}>
        <h2>Product Not Found!</h2>
      </div>
    );

  return (
    <Fragment>
      {/* Full-bleed product detail — no container wrapper */}
      <ProductDetails selectedProduct={product} />

      {/* Reviews — contained */}
      <div style={{ background: "#fff", paddingTop: "20px" }}>
        <ProductReviews selectedProduct={product} />
      </div>

      {/* Related products */}
      <section className="related-products" style={{ padding: "40px 0 60px", background: "#fafafa" }}>
        <Container>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "28px",
              color: "#111",
            }}
          >
            You Might Also Like
          </h3>
          <ShopList productItems={relatedProducts} />
        </Container>
      </section>
    </Fragment>
  );
};

export default Product;
