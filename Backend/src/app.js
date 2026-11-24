import express from "express";
import cors from "cors";
import helmet from "helmet";
import { clientOrigin } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: clientOrigin.split(",").map((origin) => origin.trim()),
  credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "BizPilot API is running." });
});

// The frontend calls the versioned path, so the same routes are served there too.
app.use("/api/v1/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
