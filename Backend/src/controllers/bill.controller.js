import { extractBillDraft } from "../services/billExtract.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const extractBill = asyncHandler(async (req, res) => {
  const data = await extractBillDraft(req.businessId, {
    file: req.upload.buffer,
    mimeType: req.upload.mimeType,
    typeHint: req.body?.type,
  });
  res.status(200).json({ success: true, data });
});
