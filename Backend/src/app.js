import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import productRoutes from "./routes/product.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import billRoutes from "./routes/bill.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import authRoutes from "./routes/auth.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import { serviceAuth } from "./middleware/serviceAuth.middleware.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { requireBusinessContext } from "./middleware/requireBusinessContext.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    // FRONTEND_ORIGIN may list several origins, separated by commas.
    origin: env.frontendOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "BizPilot API is running" });
});
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "BizPilot API is running." });
});
app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/analytics", authenticate, analyticsRoutes);
app.use("/api/v1/products", authenticate, requireBusinessContext, productRoutes);
app.use("/api/v1/inventory", authenticate, requireBusinessContext, inventoryRoutes);
app.use("/api/v1/sales", authenticate, requireBusinessContext, saleRoutes);
app.use("/api/v1/purchases", authenticate, requireBusinessContext, purchaseRoutes);
app.use("/api/v1/bills", authenticate, requireBusinessContext, billRoutes);
app.use("/api/v1/dashboard", authenticate, requireBusinessContext, dashboardRoutes);
app.use("/api/v1/profile", authenticate, requireBusinessContext, profileRoutes);
app.use("/api/v1/settings", authenticate, requireBusinessContext, settingsRoutes);
app.use("/api/v1/faqs", authenticate, requireBusinessContext, faqRoutes);
app.use("/api/faqs", authenticate, requireBusinessContext, faqRoutes);

app.use("/internal", serviceAuth, internalRoutes);

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
    message: status === 500 ? "Internal server error" : error.message,
    errors: error.errors || [],
  };

  if (error.code !== undefined) {
    response.code = error.code;
  }

  res.status(status).json(response);
});

export default app;
