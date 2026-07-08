import { Router } from "express";
import {
  addOrder,
  getOrders,
  getOrder,
} from "../controllers/order.controller";
import { validate } from "../middleware/validate";
import { createOrderSchema } from "../validators/order.validator";

const router = Router();

router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/", validate(createOrderSchema), addOrder);

export default router;