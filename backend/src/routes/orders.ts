import { Router } from "express";
import {
  addOrder,
  completeOrderImport,
  getOrders,
  getOrder,
  editOrderStatus,
} from "../controllers/order.controller";
import { validate } from "../middleware/validate";
import {
  completeImportedOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validators/order.validator";

const router = Router();

router.get("/", getOrders);
router.get("/:id", getOrder);
router.post("/", validate(createOrderSchema), addOrder);
router.post(
  "/:id/complete-import",
  validate(completeImportedOrderSchema),
  completeOrderImport
);
router.patch("/:id/status", validate(updateOrderStatusSchema), editOrderStatus);

export default router;
