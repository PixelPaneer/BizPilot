import { Router } from "express";

// Routes only the AI service may call. app.js mounts them behind serviceAuth, so req.serviceBusinessId
// is always set here. They are not versioned and not reachable with an owner's sign-in.
const router = Router();

// Foundation check, AI -> Node: the token was accepted, and this is the shop it names.
router.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", businessId: req.serviceBusinessId },
  });
});

export default router;
