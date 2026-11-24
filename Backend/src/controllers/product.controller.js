import * as productService from "../services/product.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listProducts = asyncHandler(async (req, res) => {
  const data = await productService.listProducts(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const searchProducts = asyncHandler(async (req, res) => {
  const data = await productService.searchProducts(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const getProductCategories = asyncHandler(async (req, res) => {
  const data = await productService.getProductCategories(req.businessId);
  res.status(200).json({ success: true, data });
});

export const getProduct = asyncHandler(async (req, res) => {
  const data = await productService.getProduct(req.businessId, req.params.id);
  res.status(200).json({ success: true, data });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = await productService.createProduct(
    req.businessId,
    req.user.user_id,
    req.body
  );
  res.status(201).json({ success: true, data });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = await productService.updateProduct(
    req.businessId,
    req.user.user_id,
    req.params.id,
    req.body
  );
  res.status(200).json({ success: true, data });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const data = await productService.deleteProduct(
    req.businessId,
    req.user.user_id,
    req.params.id
  );
  res.status(200).json({ success: true, data });
});
