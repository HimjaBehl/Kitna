import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { dealsTable } from "./deals";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("other"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFrequency: text("recurring_frequency"),
  vendorOrPayee: text("vendor_or_payee"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
