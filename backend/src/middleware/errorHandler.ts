import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[${new Date().toISOString()}] Request error:`, {
    method: req.method,
    path: req.path,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
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
