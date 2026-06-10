const mongoose = require("mongoose");

const pendingOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  type: { type: String, enum: ["signup", "forgot"], required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  signupData: {
    name: String,
    passwordHash: String
  }
});

module.exports = mongoose.model("PendingOtp", pendingOtpSchema);
