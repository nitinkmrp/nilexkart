import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import './Policy.css'; // Shared CSS for all policies

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="policy-section">
      <Container>
        <h1 className="policy-title">Privacy Policy</h1>
        <div className="policy-content">
          <p>This Privacy Policy explains how [YOUR COMPANY NAME] ("Nilexkart" or "we" or "us") collects, uses, discloses and otherwise manages personal information when you use the website https://Nilexkart.com/ to shop with us or otherwise share your sensitive personal information and data with us.</p>
          <p>We value our customers’ privacy and appreciate your confidence that we will respect your privacy in a careful and sensible manner.</p>
        </div>
      </Container>
    </section>
  );
};

export default PrivacyPolicy;
