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
  const recipientList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

  if (recipientList.length === 0) {
    console.warn('[emailService] No recipients specified.');
    return { skipped: true };
  }

  // 1. Primary Provider: Resend (Official SDK)
  const resend = getResendClient();
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to: recipientList,
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
        console.log(`✉️ [Resend] Email sent successfully to ${recipientList.join(', ')} (ID: ${response.data?.id})`);
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
        to: recipientList.join(', '),
        subject,
        html,
        text,
      });

      console.log(`✉️ [Nodemailer] Email sent to ${recipientList.join(', ')} (MessageID: ${info.messageId})`);
      return info;
    } catch (err) {
      console.error('[Nodemailer Error]:', err.message);
      throw err;
    }
  }

  // 3. Simulation (Local Development without credentials)
  console.warn(`\n================== [EMAIL SIMULATION] ==================`);
  console.warn(`To: ${recipientList.join(', ')}`);
  console.warn(`Subject: ${subject}`);
  console.warn(`Content: ${text || html}`);
  console.warn(`========================================================\n`);
  return { simulated: true, to: recipientList, subject };
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

/**
 * Send New Order Notification Email to configured Admin / Delivery recipient emails
 */
export const sendOrderNotificationEmail = async ({ order, recipients, orderType = 'Online Order' }) => {
  const recipientList = Array.isArray(recipients)
    ? recipients.filter((e) => e && typeof e === 'string' && e.includes('@'))
    : [recipients].filter((e) => e && typeof e === 'string' && e.includes('@'));

  if (recipientList.length === 0) {
    console.warn('[emailService] sendOrderNotificationEmail: No valid recipients found.');
    return { skipped: true };
  }

  const orderId = order.razorpayOrderId || String(order._id || 'N/A');
  const paymentId = order.razorpayPaymentId || 'COD';
  const total = Number(order.totalAmount || 0).toLocaleString('en-IN');
  const items = Array.isArray(order.items) ? order.items : [];
  const carrier = order.carrier || 'Delhivery Express';
  const trackingId = order.trackingId || 'Auto-generating';
  const shippingAddress = order.shippingAddress || 'Not specified';
  const customerEmail = order.email || 'Customer';
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = `📦 [New Order Alert] Order #${orderId} - ₹${total} (${orderType})`;

  const itemsHtml = items
    .map((item, idx) => {
      const name = item.productName || item.name || item.title || `Item ${idx + 1}`;
      const qty = item.qty || 1;
      const price = Number(item.price || 0).toLocaleString('en-IN');
      const sizeBadge = item.selectedSize
        ? `<span style="background: #e2e8f0; color: #334155; font-size: 11px; padding: 2px 7px; border-radius: 4px; margin-left: 6px; font-weight: 600;">Size: ${item.selectedSize}</span>`
        : '';
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 10px; font-size: 14px; color: #1e293b;">
            <div style="font-weight: 600;">${name} ${sizeBadge}</div>
          </td>
          <td style="padding: 12px 10px; font-size: 14px; color: #475569; text-align: center; font-weight: 600;">${qty}</td>
          <td style="padding: 12px 10px; font-size: 14px; color: #0f3460; font-weight: 700; text-align: right;">₹${price}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px 16px; background-color: #f1f5f9; color: #1e293b;">
      <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 52, 96, 0.08);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #0f3460 0%, #162447 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🛍️ NilexKart</h1>
          <div style="display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">
            🎉 New Order Placed by Customer
          </div>
        </div>

        <div style="padding: 24px 20px;">
          <!-- Order ID & Revenue Highlight Box -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: top;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Order ID</div>
                  <div style="font-size: 17px; font-weight: 800; color: #0f3460; margin-top: 2px;">#${orderId}</div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Pay ID: ${paymentId}</div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Order Total</div>
                  <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 2px;">₹${total}.00</div>
                  <div style="font-size: 11px; color: #0f3460; font-weight: 600; margin-top: 2px;">${orderType}</div>
                </td>
              </tr>
            </table>
            <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 12px;">
              📅 <strong>Order Placed:</strong> ${orderDate} &nbsp;|&nbsp; 🚚 <strong>Status:</strong> <span style="color: #0f3460; font-weight: 700;">${order.deliveryStatus || 'Confirmed'}</span>
            </div>
          </div>

          <!-- Customer & Delivery Grid -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
            <tr>
              <td style="width: 48%; vertical-align: top; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: #0f3460; text-transform: uppercase; margin-bottom: 8px;">
                  👤 Customer Details
                </div>
                <div style="font-size: 13.5px; color: #334155; margin-bottom: 4px;">
                  <strong>Email:</strong> ${customerEmail}
                </div>
                <div style="font-size: 13.5px; color: #334155;">
                  <strong>Payment Status:</strong> <span style="color: #10b981; font-weight: 600;">${order.status || 'Paid'}</span>
                </div>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; vertical-align: top; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: #0f3460; text-transform: uppercase; margin-bottom: 8px;">
                  🚚 Logistics &amp; Carrier
                </div>
                <div style="font-size: 13.5px; color: #334155; margin-bottom: 4px;">
                  <strong>Carrier:</strong> ${carrier}
                </div>
                <div style="font-size: 13.5px; color: #334155;">
                  <strong>Tracking ID:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${trackingId}</code>
                </div>
              </td>
            </tr>
          </table>

          <!-- Shipping Destination Card -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 22px;">
            <div style="font-size: 12px; font-weight: 700; color: #0f3460; text-transform: uppercase; margin-bottom: 6px;">
              📍 Shipping &amp; Delivery Destination
            </div>
            <div style="font-size: 13.5px; color: #334155; line-height: 1.5;">
              ${shippingAddress}
            </div>
          </div>

          <!-- Items Ordered Table -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 14px; font-weight: 800; color: #0f3460; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
              📦 Order Items Breakdown (${items.length})
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">Product</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; color: #64748b; text-transform: uppercase;">Qty</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b; text-transform: uppercase;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No items recorded</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- Direct Link to Admin Deliveries -->
          <div style="text-align: center; margin: 28px 0 10px 0;">
            <a href="${process.env.CLIENT_URL || 'https://nilex.in'}/admin/deliveries" style="background: linear-gradient(135deg, #0f3460 0%, #1a508b 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(15, 52, 96, 0.25);">
              ⚡ Open Admin Delivery Section
            </a>
          </div>
        </div>

        <!-- Notification Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          This real-time notification was dispatched by the NilexKart Order Delivery Automation System.<br />
          You are receiving this because your email is configured in the Admin Delivery Section.
        </div>
      </div>
    </div>
  `;

  const text = `
[NEW ORDER ALERT] Order #${orderId}
Total Amount: ₹${total}
Customer: ${customerEmail}
Type: ${orderType}
Carrier: ${carrier}
Tracking ID: ${trackingId}
Shipping Address: ${shippingAddress}

Items:
${items.map((i) => `- ${i.productName || i.name} (Qty: ${i.qty || 1}, Price: ₹${i.price})`).join('\n')}

Manage order in Admin Deliveries: ${process.env.CLIENT_URL || 'https://nilex.in'}/admin/deliveries
  `.trim();

  return sendEmail({
    to: recipientList,
    subject,
    html,
    text,
  });
};

/**
 * Send Customer Order Confirmation Email
 */
export const sendOrderConfirmationCustomerEmail = async ({ order, orderType = 'Online Order' }) => {
  if (!order.email || typeof order.email !== 'string' || !order.email.includes('@')) {
    return { skipped: true };
  }

  const orderId = order.razorpayOrderId || String(order._id || 'N/A');
  const total = Number(order.totalAmount || 0).toLocaleString('en-IN');
  const items = Array.isArray(order.items) ? order.items : [];
  const carrier = order.carrier || 'Delhivery Express';
  const trackingId = order.trackingId || 'Auto-generating';
  const shippingAddress = order.shippingAddress || 'Not specified';

  const subject = `🎉 Order Confirmed! Your NilexKart Order #${orderId}`;

  const itemsHtml = items
    .map((item, idx) => {
      const name = item.productName || item.name || item.title || `Item ${idx + 1}`;
      const qty = item.qty || 1;
      const price = Number(item.price || 0).toLocaleString('en-IN');
      const sizeBadge = item.selectedSize
        ? `<span style="background: #e2e8f0; color: #334155; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Size: ${item.selectedSize}</span>`
        : '';
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-size: 14px; color: #1e293b;">
            <strong>${name}</strong> ${sizeBadge}
          </td>
          <td style="padding: 10px 8px; font-size: 14px; color: #475569; text-align: center;">${qty}</td>
          <td style="padding: 10px 8px; font-size: 14px; color: #0f3460; font-weight: 600; text-align: right;">₹${price}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 16px; background-color: #f8fafc; color: #1e293b;">
      <div style="background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0f3460; margin: 0; font-size: 26px; font-weight: 800;">🛍️ NilexKart</h1>
          <p style="color: #10b981; font-weight: 700; font-size: 16px; margin-top: 6px;">Thank you for your order!</p>
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">
          Hi there, we have successfully received your order <strong>#${orderId}</strong> (${orderType}) and our fulfillment team is preparing it for shipment.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 13.5px; margin-bottom: 6px;"><strong>Courier Partner:</strong> ${carrier}</div>
          <div style="font-size: 13.5px; margin-bottom: 6px;"><strong>Tracking ID:</strong> <code>${trackingId}</code></div>
          <div style="font-size: 13.5px;"><strong>Delivery Destination:</strong> ${shippingAddress}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #64748b; text-transform: uppercase;">
              <th style="text-align: left; padding: 8px;">Product</th>
              <th style="text-align: center; padding: 8px;">Qty</th>
              <th style="text-align: right; padding: 8px;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid #0f3460; font-weight: 700; color: #0f3460;">
              <td colspan="2" style="padding: 12px 8px; font-size: 15px;">Total Amount Paid</td>
              <td style="padding: 12px 8px; font-size: 16px; text-align: right; color: #10b981;">₹${total}.00</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.CLIENT_URL || 'https://nilex.in'}/profile" style="background: #0f3460; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
            Track Your Order Live
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Questions? Contact customer care at customercare@nilex.in
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: order.email,
    subject,
    html,
    text: `Thank you for your order #${orderId}! Total: ₹${total}. Track live at ${process.env.CLIENT_URL || 'https://nilex.in'}/profile`,
  });
};
