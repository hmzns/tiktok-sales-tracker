import { Request, Response } from "express";
import { getAllProducts } from "../services/product.service";

export const getProducts = async (req: Request, res: Response) => {
  console.log("✅ Controller reached");

  try {
    const products = await getAllProducts();

    return res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};