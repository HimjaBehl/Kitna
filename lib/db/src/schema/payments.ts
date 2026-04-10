import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { dealsTable } from "./deals";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  receivedDate: timestamp("received_date", { withTimezone: true }).notNull(),
  notes: text("notes"),
  tdsApplicable: boolean("tds_applicable").notNull().default(false),
  tdsAmount: numeric("tds_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
