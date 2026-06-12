const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    console.error("[CEP] No MongoDB URI found in environment variables!");
    process.exit(1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000
  });
  console.log("[CEP] MongoDB connected:", uri.replace(/\/\/.*@/, "//***@"));
}

module.exports = connectDB;