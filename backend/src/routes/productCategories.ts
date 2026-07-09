import { Router } from "express";
import {
  addProductCategory,
  getProductCategories,
  getProductCategory,
  editProductCategory,
  removeProductCategory,
} from "../controllers/productCategory.controller";
import { validate } from "../middleware/validate";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
} from "../validators/productCategory.validator";

const router = Router();

router.get("/", getProductCategories);
router.get("/:id", getProductCategory);
router.post("/", validate(createProductCategorySchema), addProductCategory);
router.put("/:id", validate(updateProductCategorySchema), editProductCategory);
router.delete("/:id", removeProductCategory);

export default router;