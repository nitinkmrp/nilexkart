import { Fragment, useEffect, useState } from "react";
import Wrapper from "../components/wrapper/Wrapper";
import Section from "../components/Section";
import SliderHome from "../components/Slider";
import useWindowScrollToTop from "../hooks/useWindowScrollToTop";

const BASE_URL = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";

const Home = () => {
  const [liveProducts, setLiveProducts] = useState([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/products`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setLiveProducts(data.data);
      })
      .catch(err => console.error("Error fetching live products:", err));
  }, []);

  const discoutProducts = liveProducts.filter(item => item.discount > 0);
  const newArrivalData = liveProducts.slice(0, 8); // Display first 8 products as new arrivals
  const bestSales = liveProducts.slice(8, 16); // Display next 8 products as best sales

  useWindowScrollToTop();

  return (
    <Fragment>
      <SliderHome />
      <Wrapper />
      {discoutProducts.length > 0 && (
        <Section
          title="Big Discount"
          bgColor="#f6f9fc"
          productItems={discoutProducts}
        />
      )}
      <Section
        title="New Arrivals"
        bgColor="white"
        productItems={newArrivalData}
      />
      <Section title="Best Sales" bgColor="#f6f9fc" productItems={bestSales} />
    </Fragment>
  );
};

export default Home;
