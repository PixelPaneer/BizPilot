
const express = require("express");
const cors = require("cors");
const path = require("path");

const settingsRoutes = require("./routes/settings.routes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded business logos
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

// Settings API
app.use("/api/v1/settings", settingsRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BizPilot Backend API is running",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with this information already exists",
    });
  }

  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Related database record was not found",
    });
  }

  if (err.code === "23514" || err.code === "23502") {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing database field",
    });
  }

  if (err.message === "Business profile not found" ||
      err.message === "Business settings not found" ||
      err.message === "Account not found") {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }

  if (err.message === "Current password is incorrect") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof require("multer").MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

module.exports = app;
