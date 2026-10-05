/* =========================================================
   config/db.js — the MongoDB connection.
   ========================================================= */

import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/spendwise";

/**
 * Connect to MongoDB. Fails loudly with instructions rather than letting the
 * API start and then return 500s on every request.
 */
export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  // Fail in 5s instead of mongoose's 30s default, so a wrong URI is obvious.
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${redact(uri)}`);
  } catch (err) {
    console.error(`\nCould not connect to MongoDB at ${redact(uri)}`);
    console.error(`Reason: ${err.message}\n`);
    console.error("Fix one of these, then start the server again:");
    console.error("  1. Start a local MongoDB:  mongod");
    console.error("  2. Or point MONGODB_URI in server/.env at a MongoDB Atlas cluster");
    console.error("     (see server/.env.example for the connection string format)\n");
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

/** Never print credentials from a mongodb+srv:// URI to the console. */
function redact(uri) {
  return uri.replace(/\/\/[^@]*@/, "//<credentials>@");
}
