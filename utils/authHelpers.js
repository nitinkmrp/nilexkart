// backend/utils/authHelpers.js
export const ALLOWED_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com"];

export const isAllowedDomain = (email) => {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
};

export const generateOtp = () => {
  // 6‑digit numeric OTP
  return String(Math.floor(100000 + Math.random() * 900000));
};
