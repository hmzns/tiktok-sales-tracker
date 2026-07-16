# TikTok Sales Tracker

A sales tracking app built for small online sellers who need to manage products, orders, expenses, stock, and profit.

This project was created for TikTok Live / TikTok Shop style selling, with future support planned for TikTok Shop API integration.

## Features

### Products
- Add products
- Edit products
- Search products by name or SKU
- View low stock products
- Activate or deactivate products
- Hide inactive products when creating orders

### Product Categories
- Create product categories
- Edit product categories
- Activate or deactivate categories
- Hide inactive categories in product forms

### Orders
- Create orders
- Create orders with multiple products
- View order list
- Search orders by customer name or order number
- Filter orders by status
- View full order details
- Update order status
- Confirm cancel/refund actions
- Automatically deduct stock when orders are created
- Automatically restore stock when orders are cancelled or refunded

### Expenses
- Add expenses
- Edit expenses
- Delete expenses
- Search expenses
- Filter expenses by category

### Stock
- Manual stock adjustment
- Stock movement history
- Auto stock deduction from orders
- Auto stock restoration from cancelled/refunded orders

### Dashboard and Reports
- Monthly dashboard summary
- Monthly sales report
- Revenue, cost, profit, expenses, and net profit tracking
- Auto-refresh important screens when navigating

## Tech Stack

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- Supabase PostgreSQL
- Zod validation

### Mobile
- Expo
- React Native
- TypeScript
- Expo Router
- Axios

## Project Structure

```text
tiktok-sales-tracker/
  backend/
  mobile/
  docs/
  README.md
```

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Backend runs on:

```text
http://localhost:3000
```

Health check:

```text
GET /health
```

API docs:

```text
GET /api-docs
```

## Testing Method

### For browser testing:

```text
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### For phone testing with Expo Go, use your device IP address:

```text
EXPO_PUBLIC_API_URL=http://<YOUR IP ADDRESS>:3000
```

## Deployment Notes

### Backend

The backend can be deployed as a Node.js web service.

Production build command:

```bash
npm install
npm run build
```
Production start command:

```bash
npm start
```

Production migration command: 

```bash
npm run migrate:deploy
```

Required environment variables:

```text
DATABASE_URL=
DIRECT_URL=
PORT=3000
```

### Mobile Production API URL

For local browser testing:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

For testing on a real phone with local backend:
```text
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP_ADDRESS:3000
```

For production or hosted backend testing, update:

```text
EXPO_PUBLIC_API_URL=https://your-backend-url.com
```

Do not commit real `.env ` files.

### Supabase Connection on Render

When deploying the backend to Render with Supabase PostgreSQL, use the Supabase **Session Pooler** connection string for `DATABASE_URL`.

Avoid using the direct database URL like:

```text
db.<project-ref>.supabase.co:5432
```
because it may fail from Render depending on IPv4/IPv6 availability.

Use the Session Pooler format instead:
```text
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

### Web Frontend

The Expo web frontend is deployed on Cloudflare Pages.

Frontend URL:

```text
https://your-cloudflare-pages-url.pages.dev
```