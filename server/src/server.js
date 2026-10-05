/* =========================================================
   server.js — entry point for the Express API.
   ========================================================= */

import "dotenv/config";
import express from "express";
import cors from "cors";

import { connectDatabase } from "./config/db.js";
import { router } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

export function createApp() {
  const app = express();

  app.use(cors({ origin: CLIENT_ORIGIN }));
  // A 2 MB cap matches the backup import limit in shared/serializer.js.
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Connect before listening, so the API never accepts a request it cannot serve.
await connectDatabase();

createApp().listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}/api`);
  console.log(`Allowing requests from ${CLIENT_ORIGIN}`);
});
