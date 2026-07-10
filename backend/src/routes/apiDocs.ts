import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  return res.json({
    success: true,
    data: {
      service: "sales-tracker-api",
      version: "1.0.0",
      endpoints: {
        health: [
          {
            method: "GET",
            path: "/health",
            description: "Check API health",
          },
        ],
        products: [
          {
            method: "GET",
            path: "/products",
            description:
              "Get products with search, filter, and pagination",
            query: ["search", "page", "limit", "isActive", "categoryId"],
          },
          {
            method: "GET",
            path: "/products/low-stock",
            description: "Get low stock products",
            query: ["threshold"],
          },
          {
            method: "GET",
            path: "/products/:id",
            description: "Get product by ID",
          },
          {
            method: "POST",
            path: "/products",
            description: "Create product",
          },
          {
            method: "PUT",
            path: "/products/:id",
            description: "Update product",
          },
          {
            method: "DELETE",
            path: "/products/:id",
            description: "Delete product",
          },
        ],
        productCategories: [
          {
            method: "GET",
            path: "/product-categories",
            description: "Get all product categories",
          },
          {
            method: "GET",
            path: "/product-categories/:id",
            description: "Get product category by ID",
          },
          {
            method: "POST",
            path: "/product-categories",
            description: "Create product category",
          },
          {
            method: "PUT",
            path: "/product-categories/:id",
            description: "Update product category",
          },
          {
            method: "DELETE",
            path: "/product-categories/:id",
            description: "Delete product category",
          },
        ],
        orders: [
          {
            method: "GET",
            path: "/orders",
            description: "Get orders with search, filter, and pagination",
            query: ["search", "status", "platform", "page", "limit"],
          },
          {
            method: "GET",
            path: "/orders/:id",
            description: "Get order by ID",
          },
          {
            method: "POST",
            path: "/orders",
            description: "Create order",
          },
          {
            method: "PATCH",
            path: "/orders/:id/status",
            description: "Update order status",
          },
        ],
        expenses: [
          {
            method: "GET",
            path: "/expenses",
            description:
              "Get expenses with search, category filter, and pagination",
            query: ["search", "category", "page", "limit"],
          },
          {
            method: "GET",
            path: "/expenses/:id",
            description: "Get expense by ID",
          },
          {
            method: "POST",
            path: "/expenses",
            description: "Create expense",
          },
          {
            method: "PUT",
            path: "/expenses/:id",
            description: "Update expense",
          },
          {
            method: "DELETE",
            path: "/expenses/:id",
            description: "Delete expense",
          },
        ],
        stockMovements: [
          {
            method: "GET",
            path: "/stock-movements",
            description: "Get stock movement history",
            query: ["productId", "type", "page", "limit"],
          },
          {
            method: "POST",
            path: "/stock-movements/adjust",
            description: "Manual stock adjustment",
          },
        ],
        dashboard: [
          {
            method: "GET",
            path: "/dashboard/summary",
            description:
              "Get dashboard summary, sales, expenses, low stock, and stock activity",
            query: ["year", "month"],
          },
        ],
        reports: [
          {
            method: "GET",
            path: "/reports/monthly",
            description: "Get export-ready monthly sales report",
            query: ["year", "month"],
          },
        ],
      },
    },
  });
});

export default router;