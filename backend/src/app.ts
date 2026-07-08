import express from "express";
import cors from "cors";

import productsRouter from './routes/products';
import ordersRouter from "./routes/orders";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use('/products', productsRouter);
app.use("/orders", ordersRouter);

app.use(errorHandler);

export default app;