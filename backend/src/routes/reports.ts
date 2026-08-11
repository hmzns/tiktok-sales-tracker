import { Router } from "express";
import {
  getMonthlyReport,
  getSalesTrends,
} from "../controllers/report.controller";

const router = Router();

router.get("/monthly", getMonthlyReport);
router.get("/sales-trends", getSalesTrends);

export default router;
