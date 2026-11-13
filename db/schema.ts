import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: text("submission_id").notNull().unique(),
  visitorHash: text("visitor_hash").notNull(),
  question: text("question").notNull(),
  round: integer("round").notNull().default(1),
  allowShare: integer("allow_share", { mode: "boolean" }).notNull().default(false),
  topping: text("topping").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("questions_round_visitor_idx").on(table.round, table.visitorHash, table.id)]);

export const eventState = sqliteTable("event_state", {
  id: integer("id").primaryKey(),
  closed: integer("closed", { mode: "boolean" }).notNull().default(false),
  round: integer("round").notNull().default(1),
});
