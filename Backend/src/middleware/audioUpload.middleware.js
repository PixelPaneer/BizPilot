import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB, the same limit the AI service enforces

// Browsers record as webm or ogg, phones as m4a or mp3. The type may carry a codec ("audio/webm;codecs=opus").
const ALLOWED_TYPES = new Set([
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

export const baseMimeType = (mimetype = "") => mimetype.split(";")[0].trim().toLowerCase();

// Voice notes are kept in memory for the length of the request and sent on to the AI service;
// nothing is written to disk and nothing is kept afterwards.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(baseMimeType(file.mimetype))) {
      return cb(new ApiError(400, "Only webm, ogg, mp3, m4a or wav audio is allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5 },
});

const singleAudio = upload.single("audio");

// Runs multer and turns its errors into the API's normal 400 responses.
export function uploadAudio(req, res, next) {
  singleAudio(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "The voice note must be 5 MB or smaller"
          : "Upload a single voice note in the 'audio' field";
      return next(new ApiError(400, message));
    }
    return next(error);
  });
}
