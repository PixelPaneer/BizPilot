import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/product.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { requireBusinessContext } from "./middleware/requireBusinessContext.js";

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
app.use(
  "/api/v1/products",
  authenticate,
  requireBusinessContext,
  productRoutes
);
app.use(
  "/api/v1/inventory",
  authenticate,
  requireBusinessContext,
  inventoryRoutes
);
app.use(
  "/api/v1/sales",
  authenticate,
  requireBusinessContext,
  saleRoutes
);
app.use(
  "/api/v1/purchases",
  authenticate,
  requireBusinessContext,
  purchaseRoutes
);
app.use(
  "/api/v1/dashboard",
  authenticate,
  requireBusinessContext,
  dashboardRoutes
);
app.use(
  "/api/v1/profile",
  authenticate,
  requireBusinessContext,
  profileRoutes
);
app.use(
  "/api/v1/settings",
  authenticate,
  requireBusinessContext,
  settingsRoutes
);

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

  const response = {
    success: false,
    message:
      status === 500
        ? "Internal server error"
        : error.message,
    errors: error.errors || [],
  };

  if (error.code !== undefined) {
    response.code = error.code;
  }

  res.status(status).json(response);
});

export default app;