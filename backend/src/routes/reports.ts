import { Router } from "express";
import { getMonthlyReport } from "../controllers/report.controller";

const router = Router();

router.get("/monthly", getMonthlyReport);

export default router;