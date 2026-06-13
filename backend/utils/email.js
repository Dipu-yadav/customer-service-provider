const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

function sendGridCredentials() {
  const key = (process.env.SENDGRID_API_KEY || "").trim();
  const from = (process.env.SENDGRID_FROM || process.env.GMAIL_USER || "").trim();
  if (!key || !key.startsWith("SG.") || !from) return null;
  return { key, from };
}

function isEmailConfigured() {
  return !!sendGridCredentials();
}

function buildHtml(toName, otp, subject) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#4f46e5;">${subject}</h2>
      <p>Hello ${toName || "there"},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:8px;color:#4f46e5;">${otp}</p>
      <p style="color:#64748b;font-size:14px;">This code expires in 10 minutes.</p>
    </div>`;
}

async function sendViaSendGrid(toEmail, toName, otp, subject) {
  const cfg = sendGridCredentials();
  sgMail.setApiKey(cfg.key);

  await sgMail.send({
    from: cfg.from,
    to: toEmail,
    subject,
    html: buildHtml(toName, otp, subject),
    text: `${subject}\n\nYour OTP is: ${otp}\nValid for 10 minutes.`
  });

  console.log("[CEP] OTP sent via SendGrid HTTP API to:", toEmail);
  return { sent: true };
}

async function verifyEmailTransport() {
  return !!sendGridCredentials();
}

async function sendOTPEmail(toEmail, toName, otp, subject) {
  const recipient = (toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "invalid_recipient" };

  if (!isEmailConfigured()) {
    console.error("[CEP] No email provider configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    return await sendViaSendGrid(recipient, toName, otp, subject);
  } catch (err) {
    console.error("[CEP] SendGrid send failed:", err.message);
    return { sent: false, reason: "send_failed", error: err.message };
  }
}

module.exports = { sendOTPEmail, isEmailConfigured, verifyEmailTransport };