// Optional Cloudinary configuration for future profile/logo uploads.
// Authentication does not depend on Cloudinary.
import cloudinaryPackage from "cloudinary";
const cloudinary = cloudinaryPackage.v2;

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

export default cloudinary;
