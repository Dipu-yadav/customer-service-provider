const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cep";
  // const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000
  });
  console.log("[CEP] MongoDB connected:", uri.replace(/\/\/.*@/, "//***@"));
}

module.exports = connectDB;
