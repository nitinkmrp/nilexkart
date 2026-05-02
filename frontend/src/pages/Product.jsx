import { Fragment, useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import Banner from "../components/Banner/Banner";
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
    setLoading(true);
    // Fetch current product
    fetch(`${BASE_URL}/api/products/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProduct(data.data);
          // Fetch related products (same category)
          return fetch(`${BASE_URL}/api/products?category=${data.data.category}`);
        }
      })
      .then((res) => res && res.json())
      .then((data) => {
        if (data && data.success) {
          setRelatedProducts(data.data.filter((p) => p._id !== id));
        }
      })
      .catch((err) => console.error("Error fetching product details:", err))
      .finally(() => setLoading(false));
  }, [id]);

  useWindowScrollToTop();

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (!product) return <div className="text-center py-5"><h2>Product Not Found !!</h2></div>;

  return (
    <Fragment>
      <Banner title={product.productName} />
      <ProductDetails selectedProduct={product} />
      <ProductReviews selectedProduct={product} />
      <section className="related-products">
        <Container>
          <h3>You might also like</h3>
          <ShopList productItems={relatedProducts} />
        </Container>
      </section>
    </Fragment>
  );
};

export default Product;
