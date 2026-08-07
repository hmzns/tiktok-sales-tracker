import { Router } from "express";
import {
  addOrder,
  completeOrderImport,
  getOrders,
  getOrder,
  editOrderStatus,
  editTikTokPaymentMode,
  syncOrderTikTokFinance,
} from "../controllers/order.controller";
import { validate } from "../middleware/validate";
import {
  completeImportedOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  updateTikTokPaymentModeSchema,
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
router.patch(
  "/:id/tiktok-payment-mode",
  validate(updateTikTokPaymentModeSchema),
  editTikTokPaymentMode
);
router.post("/:id/sync-tiktok-finance", syncOrderTikTokFinance);

export default router;
