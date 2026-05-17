import { Link } from "react-router-dom";
import "./slidercard.css";

const SlideCard = ({title, desc, cover}) => {
  return (
    <div className='hero-slide'>
      <div className="hero-content">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-desc">{desc}</p>
        <Link to="/shop" className='hero-btn'>SHOP NOW</Link>
      </div>
      <div className="hero-image-wrapper">
        <img src={cover} alt={title} className="hero-image" />
      </div>
    </div>
  )
}

export default SlideCard;
