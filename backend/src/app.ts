import express from "express";
import cors from "cors";

import productsRouter from './routes/products';
import ordersRouter from "./routes/orders";
import dashboardRouter from "./routes/dashboard";
import expensesRouter from "./routes/expenses";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use('/products', productsRouter);
app.use("/orders", ordersRouter);
app.use("/dashboard", dashboardRouter);
app.use("/expenses", expensesRouter);

app.use(errorHandler);

export default app;