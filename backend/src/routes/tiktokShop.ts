import { Router } from "express";
import {
  callback,
  connect,
  getStatus,
  refresh,
} from "../controllers/tiktokShop.controller";

const router = Router();

router.post("/connect", connect);
router.get("/callback", callback);
router.get("/status", getStatus);
router.post("/refresh", refresh);

export default router;
