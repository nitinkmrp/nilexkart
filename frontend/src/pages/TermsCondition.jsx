import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import './Policy.css'; // Shared CSS for all policies

const TermsCondition = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="policy-section">
      <Container>
        <h1 className="policy-title">Terms Condition</h1>
        <div className="policy-content">
          <p>Description: OVERVIEWThis website is operated by NILEXKART.</p>
          <p>Throughout the site, the terms “we”, “us” and “our” refer to NILEXKART.</p>
          <p>NILEXKART offers this website, including all information, tools and services available from this site to you, the user, conditioned upon your acceptance of all terms, conditions</p>
        </div>
      </Container>
    </section>
  );
};

export default TermsCondition;
