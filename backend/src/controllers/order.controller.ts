import { Request, Response } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from "../services/order.service";
import { AppError } from "../utils/AppError";

export const addOrder = async (req: Request, res: Response) => {
  const order = await createOrder(req.body);

  return res.status(201).json({
    success: true,
    data: order,
  });
};

export const getOrders = async (req: Request, res: Response) => {
  const orders = await getAllOrders();

  return res.json({
    success: true,
    data: orders,
  });
};

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

export const editOrderStatus = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const order = await updateOrderStatus(id, status);

  return res.json({
    success: true,
    data: order,
  });
};