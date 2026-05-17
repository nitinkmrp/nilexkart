import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import './Policy.css'; // Shared CSS for all policies

const ShippingPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="policy-section">
      <Container>
        <h1 className="policy-title">Shipping Policy</h1>
        <div className="policy-content">
          <p>Description: Shipping Policy Pre-Paid Orders Shipping Timeline: We will ship your prepaid order within 48 hours.</p>
          <p>You will receive a tracking link via Email and WhatsApp for your convenience.</p>
          <p>Pre-Order Products: Certain products are available on a pre-order basis.</p>
          <p>For these, the tentative shipping time is mentioned under the "ABOUT</p>
        </div>
      </Container>
    </section>
  );
};

export default ShippingPolicy;
