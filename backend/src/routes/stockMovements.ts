import { Router } from "express";
import {
  addStockAdjustment,
  getStockMovements,
} from "../controllers/stockMovement.controller";
import { validate } from "../middleware/validate";
import { adjustStockSchema } from "../validators/stockMovement.validator";

const router = Router();

router.get("/", getStockMovements);
router.post("/adjust", validate(adjustStockSchema), addStockAdjustment);

export default router;