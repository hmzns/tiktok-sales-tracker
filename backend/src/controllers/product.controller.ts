import { Request, Response } from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} from "../services/product.service";
import { AppError } from "../utils/AppError";

// GET /products
export const getProducts = async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const categoryId = req.query.categoryId
  ? String(req.query.categoryId)
  : undefined;

  let isActive: boolean | undefined = undefined;

  if (req.query.isActive === "true") {
    isActive = true;
  }

  if (req.query.isActive === "false") {
    isActive = false;
  }

  const result = await getAllProducts({
    search,
    page,
    limit,
    isActive,
    categoryId,
  });

  return res.json({
    success: true,
    data: result.products,
    meta: result.meta,
  });
};

// GET /products/:id
export const getProduct = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const product = await getProductById(id);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return res.json({
    success: true,
    data: product,
  });
};

// POST /products
export const addProduct = async (req: Request, res: Response) => {
  const { name, sku, costPrice, sellPrice, stock, categoryId } = req.body;

  const product = await createProduct({
    name,
    sku,
    costPrice,
    sellPrice,
    stock,
    categoryId,
  });

  return res.status(201).json({
    success: true,
    data: product,
  });
};

// PUT /products/:id
export const editProduct = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingProduct = await getProductById(id);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  const { name, sku, costPrice, sellPrice, stock, isActive, categoryId } = req.body;

  const updatedProduct = await updateProduct(id, {
    name,
    sku,
    costPrice,
    sellPrice,
    stock,
    isActive,
    categoryId,
  });

  return res.json({
    success: true,
    data: updatedProduct,
  });
};

// DELETE /products/:id
export const removeProduct = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingProduct = await getProductById(id);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  await deleteProduct(id);

  return res.json({
    success: true,
    message: "Product deleted successfully",
  });
};

// GET /products/low-stock
export const getLowStock = async (req: Request, res: Response) => {
  const threshold = req.query.threshold ? Number(req.query.threshold) : 5;

  if (Number.isNaN(threshold) || threshold < 0) {
    throw new AppError("Invalid stock threshold", 400);
  }

  const products = await getLowStockProducts(threshold);

  return res.json({
    success: true,
    data: products,
    meta: {
      threshold,
      total: products.length,
    },
  });
};