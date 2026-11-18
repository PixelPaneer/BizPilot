import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());
app.use(cookieParser())

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "BizPilot API is running" });
});

/*
 * IMPORTANT:
 * Mount the team's verified authentication middleware here, before analytics.
 * It must set req.user.businessId from a verified token/session.
 * Example only (replace with the real middleware):
 * app.use("/api/analytics", yourAuthMiddleware, analyticsRoutes);
 *
 * Current routes include requireBusinessContext, which returns 401 unless
 * req.user.businessId has already been populated.
 */
app.use("/api/analytics", analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handling Middleware
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Internal server error"
        : error.message,
    errors: error.errors || [],
  });
});

export default app;