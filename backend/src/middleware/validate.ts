import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

export const validate =
  (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Validation failed",
      });
    }
  };