import { Request, Response } from "express";
import {
  adjustStock,
  getAllStockMovements,
} from "../services/stockMovement.service";
import { AppError } from "../utils/AppError";

export const addStockAdjustment = async (req: Request, res: Response) => {
  const result = await adjustStock(req.body);

  return res.status(201).json({
    success: true,
    data: result,
  });
};

export const getStockMovements = async (req: Request, res: Response) => {
  const productId = req.query.productId
    ? String(req.query.productId)
    : undefined;

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const allowedTypes = [
    "RESTOCK",
    "SALE",
    "CANCEL_RESTORE",
    "REFUND_RESTORE",
    "MANUAL_IN",
    "MANUAL_OUT",
    "DAMAGE",
  ] as const;

  const type = req.query.type
    ? String(req.query.type).toUpperCase()
    : undefined;

  if (type && !allowedTypes.includes(type as any)) {
    throw new AppError("Invalid stock movement type", 400);
  }

  const result = await getAllStockMovements({
    productId,
    type: type as any,
    page,
    limit,
  });

  return res.json({
    success: true,
    data: result.movements,
    meta: result.meta,
  });
};