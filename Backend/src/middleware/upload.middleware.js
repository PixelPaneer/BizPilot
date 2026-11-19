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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

export default upload;
