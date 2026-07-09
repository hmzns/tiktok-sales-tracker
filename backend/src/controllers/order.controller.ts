import { Request, Response } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from "../services/order.service";
import { AppError } from "../utils/AppError";

// POST /orders
export const addOrder = async (req: Request, res: Response) => {
  const order = await createOrder(req.body);

  return res.status(201).json({
    success: true,
    data: order,
  });
};

// GET /orders
export const getOrders = async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const allowedStatuses = [
    "PENDING",
    "PAID",
    "PACKING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ] as const;

  const allowedPlatforms = [
    "MANUAL",
    "TIKTOK_SHOP",
    "SHOPEE",
    "LAZADA",
  ] as const;

  const status = req.query.status
    ? String(req.query.status).toUpperCase()
    : undefined;

  const platform = req.query.platform
    ? String(req.query.platform).toUpperCase()
    : undefined;

  if (status && !allowedStatuses.includes(status as any)) {
    throw new AppError("Invalid order status", 400);
  }

  if (platform && !allowedPlatforms.includes(platform as any)) {
    throw new AppError("Invalid sales platform", 400);
  }

  const result = await getAllOrders({
    search,
    page,
    limit,
    status: status as any,
    platform: platform as any,
  });

  return res.json({
    success: true,
    data: result.orders,
    meta: result.meta,
  });
};

// GET /orders/:id
export const getOrder = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const order = await getOrderById(id);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return res.json({
    success: true,
    data: order,
  });
};

// PATCH /orders/:id/status
export const editOrderStatus = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const order = await updateOrderStatus(id, status);

  return res.json({
    success: true,
    data: order,
  });
};