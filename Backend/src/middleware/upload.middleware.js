import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

// Logos are kept in memory and sent on to Cloudinary; nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, "Only PNG and JPG images are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2 MB
});

const singleLogo = upload.single("logo");

// Runs multer and turns its errors into the API's normal 400 responses.
export function uploadLogo(req, res, next) {
  singleLogo(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "The logo must be 2 MB or smaller"
          : "Upload a single image in the 'logo' field";
      return next(new ApiError(400, message));
    }
    return next(error);
  });
}

export default upload;
