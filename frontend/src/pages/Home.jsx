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

  // All products with ANY discount set by admin — dynamically updated from DB
  const discoutProducts = liveProducts.filter(item => (item.discount || 0) > 0);
  const sliderData      = liveProducts.slice(0, 5);
  const newArrivalData  = liveProducts.slice(0, 8);
  const bestSales       = liveProducts.slice(8, 16);

  useWindowScrollToTop();

  return (
    <Fragment>
      <SliderHome sliderData={sliderData} />
      <Wrapper />
      {discoutProducts.length > 0 && (
        <Section
          title={`Big Discount${discoutProducts.length > 0 ? ` — ${discoutProducts.length} deals` : ""}`}
          bgColor="#ffffff"
          productItems={discoutProducts}
        />
      )}
      <Section
        title="New Arrivals"
        bgColor="#ffffff"
        productItems={newArrivalData}
      />
      <Section title="Best Sales" bgColor="#ffffff" productItems={bestSales} />
    </Fragment>
  );
};

export default Home;
