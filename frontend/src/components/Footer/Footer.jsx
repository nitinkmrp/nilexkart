import React from "react"
import "./style.css"
import { Col, Container, Row } from "react-bootstrap"

const Footer = () => {
  return (
    <footer>
      <Container>
        <Row className="footer-row">

          {/* ── Brand + About ─────────────────────────── */}
          <Col md={3} sm={6} className="box">
            <div className="logo">
              <ion-icon name="bag"></ion-icon>
              <h1>Nilexkart</h1>
            </div>
            <p>
              Your trusted online store powered by Nilex Shirts — quality clothing
              from the heart of Uttar Pradesh. Shop confidently, delivered to your door.
            </p>
            <div className="footer-social">
              <a href="https://www.nilex.in" target="_blank" rel="noreferrer" aria-label="Website">
                <ion-icon name="globe-outline"></ion-icon>
              </a>
              <a href="mailto:info@nilex.in" aria-label="Email">
                <ion-icon name="mail-outline"></ion-icon>
              </a>
            </div>
          </Col>

          {/* ── Quick Links ───────────────────────────── */}
          <Col md={2} sm={6} className="box">
            <h2>Quick Links</h2>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/shop">Shop</a></li>
              <li><a href="/cart">Cart</a></li>
              <li><a href="/profile">My Account</a></li>
              <li><a href="/payment">Checkout</a></li>
            </ul>
          </Col>

          {/* ── Customer Care ─────────────────────────── */}
          <Col md={3} sm={6} className="box">
            <h2>Customer Care</h2>
            <ul>
              <li>Help Center</li>
              <li>How to Buy</li>
              <li>Track Your Order</li>
              <li>Returns &amp; Refunds</li>
              <li>Terms &amp; Conditions</li>
              <li>Privacy Policy</li>
            </ul>
          </Col>

          {/* ── Contact + Hours ───────────────────────── */}
          <Col md={4} sm={6} className="box">
            <h2>Contact Us</h2>
            <ul className="contact-list">
              <li>
                <ion-icon name="location-outline"></ion-icon>
                <span>
                  Kaseru Chauraha, Rampur Nisfi,<br />
                  Bharthipur, Uttar Pradesh – 222203
                </span>
              </li>
              <li>
                <ion-icon name="globe-outline"></ion-icon>
                <a href="https://www.nilex.in" target="_blank" rel="noreferrer">
                  www.nilex.in
                </a>
              </li>
              <li>
                <ion-icon name="time-outline"></ion-icon>
                <span>
                  Mon–Wed, Sun: 9 am – 6 pm<br />
                  Thu: 9 am – 12 am<br />
                  Fri–Sat: 9 am – 12 am
                </span>
              </li>
            </ul>

            {/* Embedded Google Map */}
            <div className="footer-map">
              <iframe
                title="Nilex Shirts Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3578.4!2d82.57!3d25.91!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjXCsDU0JzM2LjAiTiA4MsKwMzQnMTIuMCJF!5e0!3m2!1sen!2sin!4v1!5m2!1sen!2sin&q=Nilex+Shirts,+Kaseru+Chauraha,+Rampur+Nisfi,+Bharthipur,+Uttar+Pradesh+222203"
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </Col>

        </Row>

        {/* ── Bottom bar ───────────────────────────────── */}
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Nilexkart · Nilex Shirts, Bharthipur, UP 222203</p>
          <a
            href="https://maps.app.goo.gl/6bA3x2LTsoRsqumBA"
            target="_blank"
            rel="noreferrer"
            className="footer-map-link"
          >
            <ion-icon name="navigate-outline"></ion-icon> View on Google Maps
          </a>
        </div>
      </Container>
    </footer>
  )
}

export default Footer

