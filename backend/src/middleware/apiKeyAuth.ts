import type { NextFunction, Request, Response } from "express";

export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.method === "OPTIONS" || req.path === "/health") {
    return next();
  }

  const requiredApiKey = process.env.APP_API_KEY;

  if (!requiredApiKey) {
    return res.status(500).json({
      success: false,
      message: "API key is not configured.",
    });
  }

  const providedApiKey = req.header("x-api-key");

  if (providedApiKey !== requiredApiKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized.",
    });
  }

  next();
};