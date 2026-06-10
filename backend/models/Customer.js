const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true },
    service: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    payment: { type: String, required: true },
    status: { type: String, default: "Awaiting Action" },
    date: { type: String, required: true },
    providerEmail: { type: String, default: "" },
    name: { type: String, required: true }
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    services: [serviceRequestSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
