const nodemailer = require("nodemailer");

let gmailTransporter = null;

function gmailCredentials() {
  const user = (process.env.GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  if (!user || !pass || user === "yourname@gmail.com") return null;
  return { user, pass };
}

function sendGridCredentials() {
  const key = (process.env.SENDGRID_API_KEY || "").trim();
  const from = (process.env.SENDGRID_FROM || process.env.GMAIL_USER || "").trim();
  if (!key || !key.startsWith("SG.") || !from) return null;
  return { key, from };
}

function emailJsCredentials() {
  const serviceId = (process.env.EMAILJS_SERVICE_ID || "").trim();
  const templateId = (process.env.EMAILJS_TEMPLATE_ID || "").trim();
  const publicKey = (process.env.EMAILJS_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.EMAILJS_PRIVATE_KEY || "").trim();
  const bad = ["YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", "YOUR_PUBLIC_KEY", ""];
  if (bad.includes(serviceId) || bad.includes(templateId) || bad.includes(publicKey)) {
    return null;
  }
  return { serviceId, templateId, publicKey, privateKey };
}

function isEmailConfigured() {
  return !!(sendGridCredentials() || emailJsCredentials() || gmailCredentials());
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
  const transport = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: { user: "apikey", pass: cfg.key }
  });

  await transport.sendMail({
    from: cfg.from,
    to: toEmail,
    subject,
    html: buildHtml(toName, otp, subject),
    text: `${subject}\n\nYour OTP is: ${otp}\nValid for 10 minutes.`
  });

  console.log("[CEP] OTP sent via SendGrid to customer:", toEmail);
  return { sent: true };
}

async function sendViaEmailJS(toEmail, toName, otp, subject) {
  const cfg = emailJsCredentials();
  const body = {
    service_id: cfg.serviceId,
    template_id: cfg.templateId,
    user_id: cfg.publicKey,
    template_params: {
      to_name: toName || "Customer",
      to_email: toEmail,
      user_email: toEmail,
      email: toEmail,
      otp_code: otp,
      subject,
      message: `Your verification OTP is: ${otp}. Valid for 10 minutes.`
    }
  };
  if (cfg.privateKey) body.accessToken = cfg.privateKey;

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error((await res.text()) || `EmailJS HTTP ${res.status}`);
  }

  console.log("[CEP] OTP sent via EmailJS to customer:", toEmail);
  return { sent: true };
}

async function getGmailTransporter() {
  if (gmailTransporter) return gmailTransporter;
  const creds = gmailCredentials();
  const attempts = [
    { host: "smtp.gmail.com", port: 465, secure: true },
    { host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true }
  ];
  let lastError;
  for (const cfg of attempts) {
    try {
      const t = nodemailer.createTransport({ ...cfg, auth: creds });
      await t.verify();
      gmailTransporter = t;
      console.log("[CEP] Gmail SMTP ready — sender:", creds.user);
      return t;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Gmail SMTP failed");
}

async function sendViaGmail(toEmail, toName, otp, subject) {
  const transport = await getGmailTransporter();
  const from = gmailCredentials().user;

  await transport.sendMail({
    from: `"CEP Platform" <${from}>`,
    to: toEmail,
    subject,
    html: buildHtml(toName, otp, subject),
    text: `${subject}\n\nYour OTP is: ${otp}\nValid for 10 minutes.`
  });

  console.log("[CEP] OTP sent via Gmail SMTP to customer:", toEmail);
  return { sent: true };
}

async function verifyEmailTransport() {
  if (!isEmailConfigured()) return false;
  if (sendGridCredentials()) {
    try {
      const t = nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: { user: "apikey", pass: sendGridCredentials().key }
      });
      await t.verify();
      console.log("[CEP] SendGrid SMTP ready");
      return true;
    } catch (err) {
      console.error("[CEP] SendGrid failed:", err.message);
    }
  }
  if (emailJsCredentials()) return true;
  if (gmailCredentials()) {
    try {
      await getGmailTransporter();
      return true;
    } catch (err) {
      console.error("[CEP] Gmail SMTP failed:", err.message);
      return false;
    }
  }
  return false;
}

async function sendOTPEmail(toEmail, toName, otp, subject) {
  const recipient = (toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "invalid_recipient" };

  if (!isEmailConfigured()) {
    console.error("[CEP] No email provider in backend/.env — see .env.example");
    return { sent: false, reason: "not_configured" };
  }

  const providers = [
    { name: "SendGrid", run: () => sendViaSendGrid(recipient, toName, otp, subject), ok: sendGridCredentials },
    { name: "EmailJS", run: () => sendViaEmailJS(recipient, toName, otp, subject), ok: emailJsCredentials },
    { name: "Gmail", run: () => sendViaGmail(recipient, toName, otp, subject), ok: gmailCredentials }
  ];

  let lastError = "";
  for (const p of providers) {
    if (!p.ok()) continue;
    try {
      return await p.run();
    } catch (err) {
      lastError = err.message;
      console.error(`[CEP] ${p.name} send failed:`, err.message);
    }
  }

  return { sent: false, reason: "send_failed", error: lastError };
}

module.exports = { sendOTPEmail, isEmailConfigured, verifyEmailTransport };
