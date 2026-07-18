import express from "express";
import cors from "cors";

import productsRouter from './routes/products';
import ordersRouter from "./routes/orders";
import dashboardRouter from "./routes/dashboard";
import expensesRouter from "./routes/expenses";
import productCategoriesRouter from "./routes/productCategories";
import stockMovementsRouter from "./routes/stockMovements";
import reportsRouter from "./routes/reports";
import apiDocsRouter from "./routes/apiDocs";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) =>
  origin.trim()
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (!allowedOrigins || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "sales-tracker-api",
  });
});

app.use('/products', productsRouter);
app.use("/orders", ordersRouter);
app.use("/dashboard", dashboardRouter);
app.use("/expenses", expensesRouter);
app.use("/product-categories", productCategoriesRouter);
app.use("/stock-movements", stockMovementsRouter);
app.use("/reports", reportsRouter);
app.use("/api-docs", apiDocsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;