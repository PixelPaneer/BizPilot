
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import exampleRoutes from "./routes/example.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

import { authenticate } from "./middleware/auth.middleware.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.frontendOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Health checks
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BizPilot API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BizPilot API is running",
  });
});

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/example", exampleRoutes);

// Sales Reports & Insights
// Verify JWT, then resolve the authenticated user's business.
app.use("/api/v1/analytics", authenticate, analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
