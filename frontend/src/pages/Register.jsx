import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginUser } from '../app/userSlice';
import './Register.css';

export default function Register() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const baseUrl = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";
      await axios.post(`${baseUrl}/api/auth/register`, { email, password });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const baseUrl = process.env.REACT_APP_API_URL || "https://final-project1-d3iz.onrender.com";
      const { data } = await axios.post(`${baseUrl}/api/auth/verify-otp`, {
        email,
        password,
        otp,
      });
      localStorage.setItem('jwtToken', data.token);
      dispatch(loginUser(data.data));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    }
  };

  return (
    <div className="register-wrapper">
      {step === 1 && (
        <form onSubmit={handleRegister} className="register-form">
          <h2>Register</h2>
          <input
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Send OTP</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={handleVerify} className="register-form">
          <h2>Enter OTP</h2>
          <input
            type="text"
            placeholder="6‑digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <button type="submit">Verify & Register</button>
        </form>
      )}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
