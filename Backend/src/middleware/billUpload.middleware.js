import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB, the same limit the AI service enforces
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB, likewise

// Browsers record as webm or ogg, phones as m4a or mp3. A type may carry a codec ("audio/webm;codecs=opus").
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);
// A photo from a phone camera or a saved picture.
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const ALLOWED = { audio: AUDIO_TYPES, image: IMAGE_TYPES };
const LIMITS = { audio: MAX_AUDIO_BYTES, image: MAX_IMAGE_BYTES };
const MESSAGES = {
  audio: "Only webm, ogg, mp3, m4a or wav audio is allowed in the 'audio' field",
  image: "Only jpeg, png or webp images are allowed in the 'image' field",
};

export const baseMimeType = (mimetype = "") => mimetype.split(";")[0].trim().toLowerCase();

// Files are kept in memory for the length of the request and sent on to the AI service; nothing is
// written to disk and nothing is kept afterwards.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ALLOWED[file.fieldname];
    if (!allowed) return cb(new ApiError(400, "Upload one file in the 'audio' or the 'image' field"));
    if (!allowed.has(baseMimeType(file.mimetype))) return cb(new ApiError(400, MESSAGES[file.fieldname]));
    cb(null, true);
  },
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 },
});

const bothFields = upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

// Runs multer and leaves exactly one file as req.upload = { kind: "audio" | "image", buffer, mimeType }.
// Every problem becomes the API's normal 400 response.
export function uploadBillFile(req, res, next) {
  bothFields(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "The file is too large (10 MB for a photo, 5 MB for a voice note)"
          : "Upload exactly one file, in the 'audio' or the 'image' field";
      return next(new ApiError(400, message));
    }
    if (error) return next(error);

    const files = Object.values(req.files ?? {}).flat();
    if (files.length !== 1) {
      return next(new ApiError(400, "Upload exactly one file, in the 'audio' or the 'image' field"));
    }
    const file = files[0];
    const kind = file.fieldname;
    if (file.size > LIMITS[kind]) {
      return next(
        new ApiError(400, kind === "audio" ? "The voice note must be 5 MB or smaller" : "The photo must be 10 MB or smaller")
      );
    }
    req.upload = { kind, buffer: file.buffer, mimeType: baseMimeType(file.mimetype) };
    return next();
  });
}
