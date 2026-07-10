# TikTok Sales Tracker API

A backend API for managing small business sales, products, orders, expenses, stock movements, and monthly profit reports.
This project is designed for a TikTok Live / TikTok Shop seller who wants to track sales and profit more easily instead of calculating everything manually.

## Features

* Product management
* Product category management
* Order management
* Order status update
* Automatic stock deduction when orders are created
* Automatic stock restore when orders are cancelled or refunded
* Expense tracking
* Net profit calculation
* Dashboard summary
* Daily sales breakdown
* Low stock alert
* Stock movement history
* Dashboard stock activity summary
* Monthly sales report endpoint
* Search, filter, and pagination
* JSON API documentation endpoint
* Clean JSON error response

## Tech Stack

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* PostgreSQL
* Supabase
* Zod validation

## Project Structure

```text
src/
  controllers/
  lib/
  middleware/
  routes/
  services/
  utils/
  validators/
prisma/
  schema.prisma
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then update the database connection values inside `.env`.

### 3. Run Prisma migration

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Start development server

```bash
npm run dev
```

The API should run on:

```text
http://localhost:3000
```

## Health Check

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "service": "sales-tracker-api"
}
```

## API Documentation

```http
GET /api-docs
```

This endpoint returns a JSON list of available API endpoints.

## Main Endpoints

### Products

```http
GET    /products
GET    /products/low-stock
GET    /products/:id
POST   /products
PUT    /products/:id
DELETE /products/:id
```

### Product Categories

```http
GET    /product-categories
GET    /product-categories/:id
POST   /product-categories
PUT    /product-categories/:id
DELETE /product-categories/:id
```

### Orders

```http
GET    /orders
GET    /orders/:id
POST   /orders
PATCH  /orders/:id/status
```

### Expenses

```http
GET    /expenses
GET    /expenses/:id
POST   /expenses
PUT    /expenses/:id
DELETE /expenses/:id
```

### Stock Movements

```http
GET  /stock-movements
POST /stock-movements/adjust
```

### Dashboard

```http
GET /dashboard/summary
```

Example:

```http
GET /dashboard/summary?year=2026&month=7
```

### Reports

```http
GET /reports/monthly
```

Example:

```http
GET /reports/monthly?year=2026&month=7
```

## Example: Create Product

```http
POST /products
```

```json
{
  "name": "Tudung Bawal Premium",
  "sku": "TDG001",
  "costPrice": 12,
  "sellPrice": 25,
  "stock": 20,
  "categoryId": "category_id_here"
}
```

## Example: Create Order

```http
POST /orders
```

```json
{
  "orderNumber": "ORD001",
  "platform": "MANUAL",
  "status": "PAID",
  "customerName": "Aina",
  "items": [
    {
      "productId": "product_id_here",
      "quantity": 2
    }
  ]
}
```

When an order is created, product stock is automatically deducted and a stock movement record is created.

## Example: Create Expense

```http
POST /expenses
```

```json
{
  "title": "Packaging Plastic",
  "amount": 25,
  "category": "PACKAGING",
  "description": "Plastic bags for orders",
  "expenseDate": "2026-07-08"
}
```

## Example: Manual Stock Adjustment

```http
POST /stock-movements/adjust
```

```json
{
  "productId": "product_id_here",
  "type": "RESTOCK",
  "quantity": 10,
  "note": "New stock from supplier"
}
```

## Example Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Product name is required"
    }
  ]
}
```

## Example Success Response

```json
{
  "success": true,
  "data": {}
}
```

For paginated endpoints, the response includes metadata:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Current Status

Backend API is functional and ready to be connected to a frontend or mobile application.
