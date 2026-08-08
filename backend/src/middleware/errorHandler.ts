import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isProduction = process.env.NODE_ENV === "production";
  const errorCategory =
    error instanceof AppError
      ? "APP_ERROR"
      : error instanceof Prisma.PrismaClientKnownRequestError
        ? `PRISMA_${error.code}`
        : error.name || "UNKNOWN_ERROR";

  console.error(`[${new Date().toISOString()}] Request error:`, {
    method: req.method,
    path: req.path,
    category: errorCategory,
    message: isProduction ? undefined : error.message,
    stack: isProduction ? undefined : error.stack,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2028"
  ) {
    return res.status(503).json({
      success: false,
      message: "Order completion timed out. Please try again.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
