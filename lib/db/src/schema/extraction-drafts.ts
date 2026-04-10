import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const extractionDraftsTable = pgTable("extraction_drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull().default("image"),
  entryType: text("entry_type").notNull().default("unknown"),
  rawFileUrl: text("raw_file_url"),
  extractedJson: jsonb("extracted_json"),
  confidence: text("confidence").notNull().default("low"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExtractionDraftSchema = createInsertSchema(extractionDraftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExtractionDraft = z.infer<typeof insertExtractionDraftSchema>;
export type ExtractionDraft = typeof extractionDraftsTable.$inferSelect;
