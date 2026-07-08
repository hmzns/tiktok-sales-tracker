import { Router } from "express";
import {
  addOrder,
  getOrders,
  getOrder,
  editOrderStatus,
} from "../controllers/order.controller";
import { validate } from "../middleware/validate";
import { 
  createOrderSchema,
  updateOrderStatusSchema
 } from "../validators/order.validator";

const router = Router();

router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/", validate(createOrderSchema), addOrder);
router.patch("/:id/status", validate(updateOrderStatusSchema), editOrderStatus);

export default router;