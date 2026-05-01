import { Col, Container, Row } from "react-bootstrap";
import FilterSelect from "../components/FilterSelect";
import SearchBar from "../components/SeachBar/SearchBar";
import { Fragment, useEffect, useState } from "react";
import ShopList from "../components/ShopList";
import Banner from "../components/Banner/Banner";
import useWindowScrollToTop from "../hooks/useWindowScrollToTop";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8888";

const Shop = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [filterList, setFilterList] = useState([]);
  
  useEffect(() => {
    fetch(`${BASE_URL}/api/products`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAllProducts(data.data);
          // Initial filter (e.g., sofas)
          setFilterList(data.data.filter(item => item.category === "sofa"));
        }
      })
      .catch(err => console.error("Error fetching shop products:", err));
  }, []);

  useWindowScrollToTop();

  return (
    <Fragment>
      <Banner title="product" />
      <section className="filter-bar">
        <Container className="filter-bar-contianer">
          <Row className="justify-content-center">
            <Col md={4}>
              <FilterSelect setFilterList={setFilterList} products={allProducts} />
            </Col>
            <Col md={8}>
              <SearchBar setFilterList={setFilterList} products={allProducts} />
            </Col>
          </Row>
        </Container>
        <Container>
          <ShopList productItems={filterList} />
        </Container>
      </section>
    </Fragment>
  );
};

export default Shop;
