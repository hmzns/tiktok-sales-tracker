import { 
  Request,
  Response 
} from "express";

import { 
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct
} from "../services/product.service";


// GET /products
export const getProducts = async (req: Request, res: Response) => {
  try {
    const products = await getAllProducts();

    return res.json({
      success: true,
      data: products,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// POST /products
export const addProduct = async (req: Request, res: Response) => {
  try {
    const { name, sku, costPrice, sellPrice, stock } = req.body;

    if (!name || !sku || costPrice == null || sellPrice == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // BASIC SANITY CHECKS
    if (costPrice < 0 || sellPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    if (stock != null && stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
    }

    const product = await createProduct({
      name,
      sku,
      costPrice: Number(costPrice),
      sellPrice: Number(sellPrice),
      stock: stock ? Number(stock) : 0,
    });

    return res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

// GET /products/:id
export const getProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

//PUT /products/:id
export const editProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingProduct = await getProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { 
      name, 
      sku, 
      costPrice, 
      sellPrice, 
      stock, 
      isActive 
    } = req.body;

    const updatedProduct = await updateProduct(id, {
      name,
      sku,
      costPrice,
      sellPrice,
      stock,
      isActive
    });

    return res.json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

// DELETE /products/:id
export const removeProduct = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingProduct = await getProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await deleteProduct(id);

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};