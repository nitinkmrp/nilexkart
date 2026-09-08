import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginUser } from '../app/userSlice';
import {
  requestRegisterOtpApi,
  verifyRegisterOtpApi,
  resendOtpApi,
} from '../services/userApi';
import { toast } from 'react-toastify';
import './Register.css';

export default function Register() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await requestRegisterOtpApi(email, password);
      setStep(2);
      setCooldown(60);
      toast.success('Verification code sent to your email!');
    } catch (err) {
      const msg = err.message || 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyRegisterOtpApi(email, password, otp.trim(), name);
      dispatch(loginUser(data.data));
      toast.success("Account created! You're logged in.");
      navigate('/');
    } catch (err) {
      const msg = err.message || 'Verification failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      await resendOtpApi(email, 'register');
      setCooldown(60);
      toast.success('A new OTP has been sent to your email!');
    } catch (err) {
      const msg = err.message || 'Failed to resend OTP';
      setError(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="register-wrapper">
      {step === 1 && (
        <form onSubmit={handleRegister} className="register-form">
          <h2>Create Account</h2>
          <p className="register-sub">Join NilexKart today for exclusive offers</p>

          <input
            type="text"
            placeholder="Full Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="register-password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="register-pwd-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Sending OTP…' : 'Get Verification Code'}
          </button>

          <p className="register-footer-text">
            Already have an account?{' '}
            <Link to="/" className="register-link">
              Sign In
            </Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerify} className="register-form">
          <h2>Verify Email</h2>
          <p className="register-sub">
            We sent a 6-digit code to <b>{email}</b>
          </p>

          <input
            type="text"
            className="register-otp-input"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & Register'}
          </button>

          <div className="register-actions-row">
            <button
              type="button"
              className="register-action-btn"
              onClick={() => setStep(1)}
            >
              <i className="fa fa-arrow-left me-1" /> Change Email
            </button>

            <button
              type="button"
              className="register-action-btn"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || resending}
            >
              {resending
                ? 'Sending…'
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend OTP'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

