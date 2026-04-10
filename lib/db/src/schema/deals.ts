import { pgTable, text, serial, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull(),
  campaignName: text("campaign_name").notNull(),
  incomeType: text("income_type").notNull().default("brand_collab"),
  amountAgreed: numeric("amount_agreed", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("active"),
  isBarter: boolean("is_barter").notNull().default(false),
  barterEstimatedValue: numeric("barter_estimated_value", { precision: 12, scale: 2 }),
  barterDescription: text("barter_description"),
  taxableFlag: boolean("taxable_flag").notNull().default(false),
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date", { withTimezone: true }),
  invoiceStatus: text("invoice_status").notNull().default("not_raised"),
  invoiceAmount: numeric("invoice_amount", { precision: 12, scale: 2 }),
  managerCutType: text("manager_cut_type"),
  managerCutValue: numeric("manager_cut_value", { precision: 12, scale: 2 }),
  agencyCutType: text("agency_cut_type"),
  agencyCutValue: numeric("agency_cut_value", { precision: 12, scale: 2 }),
  gstApplicable: boolean("gst_applicable").notNull().default(false),
  taxableValue: numeric("taxable_value", { precision: 12, scale: 2 }),
  tdsApplicable: boolean("tds_applicable").notNull().default(false),
  tdsAmount: numeric("tds_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
