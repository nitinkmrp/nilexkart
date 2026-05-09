import Slider from "react-slick"
import "slick-carousel/slick/slick.css"
import "slick-carousel/slick/slick-theme.css"
import { Container } from "react-bootstrap"
import SlideCard from "./SliderCard/SlideCard"

const SliderHome = ({ sliderData }) => {
  const settings = {
    nav:false,
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
  }

  // Fallback if data is not loaded yet
  if (!sliderData || sliderData.length === 0) return null;

  return (
      <section className='homeSlide'>
        <Container>
          <Slider {...settings}>
          {sliderData.map((value, index) => {
            return (
              <SlideCard key={index} title={value.productName} cover={value.imgUrl} desc={value.shortDesc} />
            )
          })}
        </Slider>
        </Container>
      </section>
  )
}

export default SliderHome
