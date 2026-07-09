import { Request, Response } from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/product.service";
import { AppError } from "../utils/AppError";

// GET /products
export const getProducts = async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

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
  const { name, sku, costPrice, sellPrice, stock } = req.body;

  const product = await createProduct({
    name,
    sku,
    costPrice,
    sellPrice,
    stock,
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

  const { name, sku, costPrice, sellPrice, stock, isActive } = req.body;

  const updatedProduct = await updateProduct(id, {
    name,
    sku,
    costPrice,
    sellPrice,
    stock,
    isActive,
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