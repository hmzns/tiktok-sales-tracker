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

### Access Protection

The Cloudflare Pages frontend is protected using Cloudflare Access email OTP.

Only approved email addresses can access the web app.

To update access:
Cloudflare Zero Trust → Access → Applications → TikTok Sales Tracker → Policies

## Production Safety Notes

This project uses several safety layers for the deployed web app and backend API.

### 1. Cloudflare Access

The Cloudflare Pages frontend is protected using Cloudflare Access email OTP.

Only approved email addresses can access the web app.

To update allowed users:

```text
Cloudflare Zero Trust → Access → Applications → TikTok Sales Tracker → Policies
```

### 2. Backend CORS Protection

The backend only allows browser requests from approved frontend URLs.

Render environment variable:

```text
ALLOWED_ORIGINS=https://your-cloudflare-pages-url.pages.dev
```

For local testing, include the local Expo web URL:

```text
ALLOWED_ORIGINS=http://localhost:8081,https://your-cloudflare-pages-url.pages.dev
```

Do not include trailing slashes.

Correct:

```text
https://your-cloudflare-pages-url.pages.dev
```

Wrong:

```text
https://your-cloudflare-pages-url.pages.dev/
```

### 3. Backend API Key Protection

Most backend endpoints require an API key using this header:

```text
x-api-key
```

Render environment variable:

```text
APP_API_KEY=your-secure-api-key
```

Cloudflare Pages environment variable:

```text
EXPO_PUBLIC_BACKEND_API_KEY=your-secure-api-key
```

The value must be the same in Render and Cloudflare Pages. Do not commit the real API key to GitHub.

### 4. Postman Testing

Protected endpoints must include this header in Postman:

```text
Key: x-api-key
Value: your-secure-api-key
```

Examples of protected endpoints:

```text
GET /products
GET /orders
GET /expenses
GET /dashboard/summary
GET /reports/monthly
POST /products
POST /orders
PUT /products/:id
DELETE /products/:id
```

The health check does not require an API key:

```text
GET /health
```

Expected result:

```text
GET /health without x-api-key → 200
GET /products without x-api-key → 401
GET /products with x-api-key → 200
```

### 5. Local vs Live API URL

For local backend testing, use this in mobile/.env:

```text
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_BACKEND_API_KEY=your-secure-api-key
```

This makes the local frontend call the local backend.

For live deployment, Cloudflare Pages should use:

```text
EXPO_PUBLIC_API_URL=https://tiktok-sales-tracker-api.onrender.com
EXPO_PUBLIC_BACKEND_API_KEY=your-secure-api-key
```

### 6. Backend Logging

The backend logs requests in this format:

```text
[2026-07-21T01:30:00.000Z] GET /products 200 - 35ms
```

Local backend logs appear in the local backend terminal.

Live backend logs appear in:

```text
Render → Backend service → Logs
```

### 7. Rate Limiting

The backend uses rate limiting to reduce repeated spam requests.

Current limit:

```text
300 requests per 15 minutes per IP
```

The /health endpoint and OPTIONS requests are skipped.