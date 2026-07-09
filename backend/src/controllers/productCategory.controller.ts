import { Request, Response } from "express";
import {
  createProductCategory,
  getAllProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
} from "../services/productCategory.service";
import { AppError } from "../utils/AppError";

export const addProductCategory = async (req: Request, res: Response) => {
  const category = await createProductCategory(req.body);

  return res.status(201).json({
    success: true,
    data: category,
  });
};

export const getProductCategories = async (req: Request, res: Response) => {
  const categories = await getAllProductCategories();

  return res.json({
    success: true,
    data: categories,
  });
};

export const getProductCategory = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const category = await getProductCategoryById(id);

  if (!category) {
    throw new AppError("Product category not found", 404);
  }

  return res.json({
    success: true,
    data: category,
  });
};

export const editProductCategory = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingCategory = await getProductCategoryById(id);

  if (!existingCategory) {
    throw new AppError("Product category not found", 404);
  }

  const category = await updateProductCategory(id, req.body);

  return res.json({
    success: true,
    data: category,
  });
};

export const removeProductCategory = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingCategory = await getProductCategoryById(id);

  if (!existingCategory) {
    throw new AppError("Product category not found", 404);
  }

  await deleteProductCategory(id);

  return res.json({
    success: true,
    message: "Product category deleted successfully",
  });
};