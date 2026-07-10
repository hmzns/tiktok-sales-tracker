import { Request, Response } from "express";
import { getMonthlySalesReport } from "../services/report.service";
import { AppError } from "../utils/AppError";

export const getMonthlyReport = async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;

  if (year && (Number.isNaN(year) || year < 2000)) {
    throw new AppError("Invalid report year", 400);
  }

  if (month && (Number.isNaN(month) || month < 1 || month > 12)) {
    throw new AppError("Invalid report month", 400);
  }

  const report = await getMonthlySalesReport({
    year,
    month,
  });

  return res.json({
    success: true,
    data: report,
  });
};