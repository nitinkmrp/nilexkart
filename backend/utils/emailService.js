// backend/utils/emailService.js
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

let resendClient = null;

// Initialize Resend client if API key is present
const getResendClient = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Helper to format 'from' field strictly for Resend: "Name <email@domain.com>" or "email@domain.com"
const formatFromAddress = (rawFrom) => {
  const appName = (process.env.APP_NAME || 'NilexKart').replace(/["'<>]/g, '').trim();
  if (!rawFrom || !rawFrom.trim()) {
    return `${appName} <customercare@nilex.in>`;
  }
  // Strip outer quotes if any
  let cleaned = rawFrom.trim().replace(/^["']+|["']+$/g, '');
  // Remove quotes from display name if formatted like "Name" <email>
  cleaned = cleaned.replace(/^"([^"]+)"\s*(<[^>]+>)$/, '$1 $2');
  // If it's just an email without brackets and name, it's valid as is
  return cleaned;
};


export const sendEmail = async ({ to, subject, html, text }) => {
  const fromEmail = formatFromAddress(process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM);


  // 1. Primary Provider: Resend (Official SDK)
  const resend = getResendClient();
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });

      if (response.error) {
        console.error('[Resend Error]:', response.error);
        if (response.error.message?.includes('testing emails to your own email address')) {
          console.warn('\n⚠️ [Resend Sandbox Limitation]:');
          console.warn('   Using "onboarding@resend.dev" only allows sending to your registered account email (nitinkmrp@gmail.com).');
          console.warn('   To send to any recipient: Verify your domain at https://resend.com/domains and set RESEND_FROM_EMAIL="NilexKart <auth@yourdomain.com>"\n');
        }
        if (!process.env.SMTP_USER) {
          throw new Error(response.error.message || 'Resend email delivery failed');
        }
      } else {
        console.log(`✉️ [Resend] Email sent successfully to ${to} (ID: ${response.data?.id})`);
        return response.data;
      }
    } catch (err) {
      console.error('[Resend Exception]:', err.message);
      // Fallback to Nodemailer if configured
      if (!process.env.SMTP_USER) throw err;
    }
  }


  // 2. Fallback Provider: Nodemailer (SMTP)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        text,
      });

      console.log(`✉️ [Nodemailer] Email sent to ${to} (MessageID: ${info.messageId})`);
      return info;
    } catch (err) {
      console.error('[Nodemailer Error]:', err.message);
      throw err;
    }
  }

  // 3. Simulation (Local Development without credentials)
  console.warn(`\n================== [EMAIL SIMULATION] ==================`);
  console.warn(`To: ${to}`);
  console.warn(`Subject: ${subject}`);
  console.warn(`Content: ${text || html}`);
  console.warn(`========================================================\n`);
  return { simulated: true, to, subject };
};

/**
 * Send branded NilexKart OTP Verification or Password Reset Email
 */
export const sendAuthEmail = async (email, otp, purpose = 'register') => {
  const isReset = purpose === 'forgot_password';
  const subject = isReset
    ? `Password Reset Code: ${otp} - NilexKart`
    : `Your Verification Code: ${otp} - NilexKart`;

  const title = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subtitle = isReset
    ? 'Use the 6-digit code below to reset your NilexKart account password.'
    : 'Use the 6-digit verification code below to complete your NilexKart registration.';

  const html = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f3460; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">🛍 NilexKart</h1>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0f3460; margin-top: 0; font-size: 20px; font-weight: 600;">${title}</h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">${subtitle}</p>
        <div style="background: #0f3460; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 14px 24px; border-radius: 10px; display: inline-block; font-family: monospace;">
          ${otp}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px; margin-bottom: 0;">This code is valid for <b>10 minutes</b>.</p>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 16px;">
        If you did not request this verification code, you can safely ignore this email. Someone may have typed your email address by mistake.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} NilexKart. All rights reserved.
      </p>
    </div>
  `;

  const text = `${title}\n\n${subtitle}\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};
