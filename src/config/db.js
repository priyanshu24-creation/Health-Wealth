const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/health-welth");
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Database connection failed:", error);
    // Don't exit process, let it fallback to JSON if we want, but user wants MongoDB.
    // However, if it fails, server might not work as expected.
    // Let's just log it and maybe the server.js will handle it.
  }
};

module.exports = connectDB;