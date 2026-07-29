import { Router } from "express";
import {
  callback,
  connect,
  getStatus,
  refresh,
  syncShop,
} from "../controllers/tiktokShop.controller";

const router = Router();

router.post("/connect", connect);
router.get("/callback", callback);
router.get("/status", getStatus);
router.post("/refresh", refresh);
router.post("/shop/sync", syncShop);

export default router;
