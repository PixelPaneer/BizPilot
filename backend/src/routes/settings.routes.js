const express = require("express");
const router = express.Router();

const controller = require("../controllers/settings.controller");
const { validateSettings } = require("../validators/settings.validator");

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.user_id || !req.user.business_id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

router.use(requireAuth);

router.get("/", controller.getSettings);
router.patch("/", validateSettings, controller.updateSettings);

module.exports = router;