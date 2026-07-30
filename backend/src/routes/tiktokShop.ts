import { Router } from "express";
import {
  callback,
  connect,
  getStatus,
  refresh,
  syncOrders,
  syncShop,
} from "../controllers/tiktokShop.controller";
import { validate } from "../middleware/validate";
import { syncTikTokOrdersSchema } from "../validators/tiktokShop.validator";

const router = Router();

router.post("/connect", connect);
router.get("/callback", callback);
router.get("/status", getStatus);
router.post("/refresh", refresh);
router.post("/shop/sync", syncShop);
router.post("/orders/sync", validate(syncTikTokOrdersSchema), syncOrders);

export default router;
