import { Router } from "express";
import {
  addExpense,
  getExpenses,
  getExpense,
  editExpense,
  removeExpense,
} from "../controllers/expense.controller";
import { validate } from "../middleware/validate";
import {
  createExpenseSchema,
  updateExpenseSchema,
} from "../validators/expense.validator";

const router = Router();

router.get("/", getExpenses);
router.get("/:id", getExpense);
router.post("/", validate(createExpenseSchema), addExpense);
router.put("/:id", validate(updateExpenseSchema), editExpense);
router.delete("/:id", removeExpense);

export default router;