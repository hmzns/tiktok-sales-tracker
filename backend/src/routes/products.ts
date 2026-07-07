import { Router } from "express";
import { 
    getProducts,
    addProduct,
    getProduct,
    editProduct,
    removeProduct
} from "../controllers/product.controller";

const router = Router();

// GET all products
router.get("/", getProducts);
// GET product by ID
router.get("/:id", getProduct);
// POST create product
router.post("/", addProduct);
// PUT update product
router.put("/:id", editProduct);
// DELETE product
router.delete("/:id", removeProduct);

export default router;