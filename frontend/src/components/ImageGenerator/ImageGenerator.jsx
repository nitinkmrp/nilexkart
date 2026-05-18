// src/components/ImageGenerator/ImageGenerator.jsx
import React, { useState, useEffect } from 'react';
import './ImageGenerator.css';
import uploadImage from '../../utils/uploadImage';

const ADOBE_CLIENT_ID = process.env.REACT_APP_ADOBE_CLIENT_ID || 'YOUR_ADOBE_CLIENT_ID';

export default function ImageGenerator({ onImageUploaded }) {
  const [showModal, setShowModal] = useState(false);
  const [loadingSdk, setLoadingSdk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (showModal) {
      // Load Adobe SDK script when modal opens
      const scriptId = 'adobe-express-sdk';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cp.adobe.io/v1/express/embed.js';
        script.async = true;
        script.onload = () => setLoadingSdk(false);
        script.onerror = () => setError('Failed to load Adobe SDK');
        setLoadingSdk(true);
        document.body.appendChild(script);
      }
    }
  }, [showModal]);

  const openEditor = () => {
    if (!ADOBE_CLIENT_ID || ADOBE_CLIENT_ID === 'YOUR_ADOBE_CLIENT_ID') {
      setError('Adobe client ID not configured.');
      return;
    }
    setShowModal(true);
  };

  const handleExport = async (blob) => {
    try {
      const imageUrl = await uploadImage(blob);
      onImageUploaded(imageUrl);
      setShowModal(false);
    } catch (e) {
      setError('Upload failed');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  return (
    <div className="image-generator">
      <button className="generate-btn" onClick={openEditor}>Generate Image (Adobe)</button>
      {error && <p className="error-msg">{error}</p>}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {loadingSdk ? (
              <p>Loading Adobe editor...</p>
            ) : (
              <div
                id="adobe-express-container"
                data-client-id={ADOBE_CLIENT_ID}
                data-mode="editor"
                data-return="blob"
                data-on-export="handleExport"
                style={{ width: '100%', height: '100%' }}
              ></div>
            )}
            <button className="close-btn" onClick={closeModal}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
