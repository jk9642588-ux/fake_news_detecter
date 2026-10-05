// Keep the schema entrypoint present so models can define tables and run
// `npx drizzle-kit push` without bootstrapping Drizzle config first.
import { pgTable, serial, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  inputType: varchar("input_type", { length: 32 }).notNull(),
  inputRaw: text("input_raw").notNull(),
  title: text("title").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  sourceName: text("source_name").notNull().default(""),
  language: varchar("language", { length: 32 }).notNull().default(""),
  region: varchar("region", { length: 64 }).notNull().default(""),
  category: varchar("category", { length: 64 }).notNull().default(""),
  verdict: varchar("verdict", { length: 32 }).notNull().default(""),
  confidence: varchar("confidence", { length: 16 }).notNull().default(""),
  score: integer("score").notNull().default(0),
  reasons: jsonb("reasons").notNull().$type<string[]>().default([]),
  realNews: jsonb("real_news").notNull().$type<{ title: string; source: string; url: string }[]>().default([]),
  factChecks: jsonb("fact_checks")
    .notNull()
    .$type<{ rating: string; publisher: string }[]>()
    .default([]),
  contentPreview: text("content_preview").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
