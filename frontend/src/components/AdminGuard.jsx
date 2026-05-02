import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

/**
 * AdminGuard — wraps admin-only routes.
 * • Not logged in   → redirect to /
 * • Logged in, not admin → show 403 screen
 * • Admin → render children
 */
const AdminGuard = ({ children }) => {
  const currentUser = useSelector((s) => s.users.currentUser);

  if (!currentUser) return <Navigate to="/" replace />;

  if (currentUser.role !== 'admin') {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        color: '#fff',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 8px' }}>403</h1>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12, color: '#f87171' }}>
          Access Denied
        </h2>
        <p style={{ color: '#cbd5e1', maxWidth: 400, lineHeight: 1.6, marginBottom: 32 }}>
          You don't have permission to view this page.
          This area is restricted to administrators only.
        </p>
        <a
          href="/"
          style={{
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            color: '#fff',
            padding: '12px 32px',
            borderRadius: 50,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 15,
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          }}
        >
          ← Back to Home
        </a>
      </div>
    );
  }

  return children;
};

export default AdminGuard;
