import { extractFromVoice } from "../services/billExtract.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { baseMimeType } from "../middleware/audioUpload.middleware.js";

export const extractBill = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Send a voice note in the 'audio' field");
  }
  const data = await extractFromVoice(req.businessId, {
    audio: req.file.buffer,
    mimeType: baseMimeType(req.file.mimetype),
    typeHint: req.body?.type,
  });
  res.status(200).json({ success: true, data });
});
