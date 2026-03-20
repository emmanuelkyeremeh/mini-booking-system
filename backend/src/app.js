import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import servicesRouter from "./routes/services.js";
import availabilityRouter from "./routes/availability.js";
import slotsRouter from "./routes/slots.js";
import bookingsRouter from "./routes/bookings.js";

export function createApp() {
  const env = getEnv();

  const app = express();
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  const corsOptions = env.CORS_ORIGIN
    ? { origin: env.CORS_ORIGIN }
    : { origin: true };
  app.use(cors(corsOptions));

  app.get("/", (_req, res) => {
    res.status(200).json({ service: "mini-booking-api" });
  });

  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", servicesRouter);
  app.use("/api", availabilityRouter);
  app.use("/api", slotsRouter);
  app.use("/api", bookingsRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}

