import { Router } from "express";
import { getSummary } from "../controllers/dashboard.controller";

const router = Router();

router.get("/summary", getSummary);

export default router;