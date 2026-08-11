import { Request, Response } from "express";
import { getDashboardSummary } from "../services/dashboard.service";

export const getSummary = async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;

  const summary = await getDashboardSummary({
    year,
    month,
  });

  return res.json({
    success: true,
    data: summary,
  });
};