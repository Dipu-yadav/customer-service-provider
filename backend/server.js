const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { isEmailConfigured, verifyEmailTransport } = require("./utils/email");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "null"
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, true);
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cep-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

async function start() {
  await connectDB();
  if (isEmailConfigured()) {
    const ok = await verifyEmailTransport();
    if (!ok) {
      console.error("[CEP] OTP email credentials are set but connection failed. Fix backend/.env");
    }
  } else {
    console.error(
      "[CEP] OTP email NOT configured — add to backend/.env (see .env.example):\n" +
        "  SENDGRID_API_KEY + SENDGRID_FROM  (recommended)\n" +
        "  OR GMAIL_APP_PASSWORD (16-char Google App Password)\n" +
        "  OR EmailJS keys"
    );
  }
  app.listen(PORT, () => {
    console.log(`[CEP] API running at http://localhost:${PORT}`);
    console.log(`[CEP] Frontend: http://localhost:${PORT}/`);
  });
}

start().catch((err) => {
  console.error("[CEP] Failed to start:", err.message);
  process.exit(1);
});
