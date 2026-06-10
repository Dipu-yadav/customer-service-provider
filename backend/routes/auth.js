const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const PendingOtp = require("../models/PendingOtp");
const { isValidGmail } = require("../utils/gmail");
const { generateOTP, otpExpiryMinutes } = require("../utils/otp");
const { sendOTPEmail } = require("../utils/email");

const router = express.Router();

function signToken(customer) {
  return jwt.sign(
    { email: customer.email, name: customer.name, role: "customer" },
    process.env.JWT_SECRET || "cep_dev_secret",
    { expiresIn: "7d" }
  );
}

function otpSendErrorMessage(mail, em) {
  console.error("[CEP] OTP to customer failed:", em, mail.reason, mail.error || "");
  return `We could not send a verification code to ${em}. Please check your Gmail address and try again.`;
}

async function clearPending(email, type) {
  await PendingOtp.deleteMany({ email: email.toLowerCase(), type });
}

// POST /api/auth/signup/send-otp
router.post("/signup/send-otp", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const em = (email || "").trim().toLowerCase();
    const nm = (name || "").trim();

    if (!nm || !em || !password) {
      return res.status(400).json({ error: "Please fill in all fields." });
    }
    if (!isValidGmail(em)) {
      return res.status(400).json({
        error: "Only valid Gmail addresses are allowed (e.g. name@gmail.com)."
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await Customer.findOne({ email: em });
    if (existing && existing.emailVerified) {
      return res.status(400).json({ error: "This Gmail is already registered. Please sign in." });
    }

    const otp = generateOTP();
    const passwordHash = await bcrypt.hash(password, 10);

    await clearPending(em, "signup");
    await PendingOtp.create({
      email: em,
      type: "signup",
      otp,
      expiresAt: otpExpiryMinutes(10),
      signupData: { name: nm, passwordHash }
    });

    const mail = await sendOTPEmail(em, nm, otp, "Your CEP Platform Signup OTP");

    if (!mail.sent) {
      await clearPending(em, "signup");
      return res.status(503).json({ error: otpSendErrorMessage(mail, em) });
    }

    res.json({
      message: `OTP sent to ${em}. Check your Gmail inbox and spam folder.`,
      email: em,
      emailSent: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

// POST /api/auth/signup/resend-otp
router.post("/signup/resend-otp", async (req, res) => {
  try {
    const em = (req.body.email || "").trim().toLowerCase();
    if (!em) return res.status(400).json({ error: "Email is required." });

    const pending = await PendingOtp.findOne({ email: em, type: "signup" });
    if (!pending || !pending.signupData) {
      return res.status(400).json({ error: "No pending signup. Please start again." });
    }

    const otp = generateOTP();
    pending.otp = otp;
    pending.expiresAt = otpExpiryMinutes(10);
    await pending.save();

    const mail = await sendOTPEmail(
      em,
      pending.signupData.name,
      otp,
      "Your CEP Platform Signup OTP (Resent)"
    );

    if (!mail.sent) {
      return res.status(503).json({ error: otpSendErrorMessage(mail, em) });
    }

    res.json({
      message: `New OTP sent to ${em}.`,
      emailSent: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend OTP." });
  }
});

// POST /api/auth/signup/verify
router.post("/signup/verify", async (req, res) => {
  try {
    const em = (req.body.email || "").trim().toLowerCase();
    const entered = String(req.body.otp || "").trim();

    if (!em || entered.length !== 6) {
      return res.status(400).json({ error: "Please enter the 6-digit OTP." });
    }

    const pending = await PendingOtp.findOne({ email: em, type: "signup" });
    if (!pending) {
      return res.status(400).json({ error: "Session expired. Please restart signup." });
    }
    if (new Date() > pending.expiresAt) {
      return res.status(400).json({ error: "OTP has expired. Please resend." });
    }
    if (entered !== pending.otp) {
      return res.status(400).json({ error: "Incorrect OTP. Please try again." });
    }

    let customer = await Customer.findOne({ email: em });
    if (customer) {
      customer.name = pending.signupData.name;
      customer.password = pending.signupData.passwordHash;
      customer.emailVerified = true;
    } else {
      customer = await Customer.create({
        name: pending.signupData.name,
        email: em,
        password: pending.signupData.passwordHash,
        emailVerified: true,
        services: []
      });
    }

    await clearPending(em, "signup");

    res.json({
      message: "Account verified successfully! You can now sign in.",
      email: em
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const em = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!em || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (!isValidGmail(em)) {
      return res.status(400).json({
        error: "Customer login requires a registered Gmail address."
      });
    }

    const customer = await Customer.findOne({ email: em });
    if (!customer || !customer.emailVerified) {
      return res.status(401).json({
        error: "Invalid credentials or account not verified. Sign up with Gmail OTP first."
      });
    }

    const match = await bcrypt.compare(password, customer.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(customer);
    res.json({
      token,
      user: {
        name: customer.name,
        email: customer.email,
        role: "customer"
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

// POST /api/auth/forgot/send-otp
router.post("/forgot/send-otp", async (req, res) => {
  try {
    const em = (req.body.email || "").trim().toLowerCase();

    if (!em || !isValidGmail(em)) {
      return res.status(400).json({
        error: "Enter your registered Gmail address (e.g. name@gmail.com)."
      });
    }

    const customer = await Customer.findOne({ email: em, emailVerified: true });
    if (!customer) {
      return res.status(404).json({ error: "No verified account found with this Gmail." });
    }

    const otp = generateOTP();
    await clearPending(em, "forgot");
    await PendingOtp.create({
      email: em,
      type: "forgot",
      otp,
      expiresAt: otpExpiryMinutes(10)
    });

    const mail = await sendOTPEmail(
      em,
      customer.name,
      otp,
      "Your CEP Platform Password Reset OTP"
    );

    if (!mail.sent) {
      await clearPending(em, "forgot");
      return res.status(503).json({ error: otpSendErrorMessage(mail, em) });
    }

    res.json({
      message: `OTP sent to ${em}. Check your Gmail inbox and spam folder.`,
      email: em,
      emailSent: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send reset OTP." });
  }
});

// POST /api/auth/forgot/reset
router.post("/forgot/reset", async (req, res) => {
  try {
    const em = (req.body.email || "").trim().toLowerCase();
    const entered = String(req.body.otp || "").trim();
    const newPassword = req.body.newPassword || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!em || entered.length !== 6) {
      return res.status(400).json({ error: "Please enter the 6-digit OTP." });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const pending = await PendingOtp.findOne({ email: em, type: "forgot" });
    if (!pending) {
      return res.status(400).json({ error: "Session expired. Please start over." });
    }
    if (new Date() > pending.expiresAt) {
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }
    if (entered !== pending.otp) {
      return res.status(400).json({ error: "Incorrect OTP. Please try again." });
    }

    const customer = await Customer.findOne({ email: em });
    if (!customer) {
      return res.status(404).json({ error: "Account not found." });
    }

    customer.password = await bcrypt.hash(newPassword, 10);
    await customer.save();
    await clearPending(em, "forgot");

    res.json({
      message: "Password reset successfully! Please sign in.",
      email: em
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Password reset failed." });
  }
});

module.exports = router;
