import { Request, Response } from "express";
import {
  getMonthlySalesReport,
  getSalesTrendsReport,
} from "../services/report.service";
import { AppError } from "../utils/AppError";
import {
  countBusinessDays,
  parseBusinessDate,
} from "../utils/reportDates";

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

export const getSalesTrends = async (req: Request, res: Response) => {
  const startDate =
    typeof req.query.startDate === "string" ? req.query.startDate : "";
  const endDate =
    typeof req.query.endDate === "string" ? req.query.endDate : "";
  const parsedStartDate = parseBusinessDate(startDate);
  const parsedEndDate = parseBusinessDate(endDate);

  if (!parsedStartDate || !parsedEndDate) {
    throw new AppError(
      "startDate and endDate must use the YYYY-MM-DD format",
      400
    );
  }

  if (parsedStartDate > parsedEndDate) {
    throw new AppError("startDate must be on or before endDate", 400);
  }

  if (
    countBusinessDays({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    }) > 366
  ) {
    throw new AppError("Sales trends are limited to 366 days", 400);
  }

  const report = await getSalesTrendsReport({ startDate, endDate });

  return res.json({
    success: true,
    data: report,
  });
};
