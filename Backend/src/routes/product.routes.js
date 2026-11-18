import { Router } from "express";
import {
  getProduct,
  getProductCategories,
  listProducts,
  searchProducts,
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/product.controller.js";
import {
  validateCreateProduct,
  validateProductId,
  validateProductListQuery,
  validateProductSearchQuery,
  validateUpdateProduct,
} from "../validators/product.validator.js";

const router = Router();

router.get("/", validateProductListQuery, listProducts);
router.get("/search", validateProductSearchQuery, searchProducts);
router.get("/categories", getProductCategories);
router.post("/", validateCreateProduct, createProduct);
router.get("/:id", validateProductId, getProduct);
router.patch("/:id", validateProductId, validateUpdateProduct, updateProduct);
router.delete("/:id", validateProductId, deleteProduct);

export default router;
