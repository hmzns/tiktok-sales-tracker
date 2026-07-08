import { Router } from "express";
import { getProducts, addProduct, getProduct, editProduct, removeProduct } from "../controllers/product.controller";
import { validate } from "../middleware/validate";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/product.validator";

const router = Router();

// GET all products
router.get("/", getProducts);
// GET product by ID
router.get("/:id", getProduct);
// POST create product
router.post("/", validate(createProductSchema), addProduct);
// PUT update product
router.put("/:id", validate(updateProductSchema), editProduct);
// DELETE product
router.delete("/:id", removeProduct);

export default router;