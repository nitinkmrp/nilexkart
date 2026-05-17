import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import './Policy.css'; // Shared CSS for all policies

const RefundPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="policy-section">
      <Container>
        <h1 className="policy-title">Refund Policy</h1>
        <div className="policy-content">
          <p>##### Return, Refund & Cancellation Policy</p>
        </div>
      </Container>
    </section>
  );
};

export default RefundPolicy;
