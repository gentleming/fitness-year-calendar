import { sql } from "drizzle-orm";
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workoutCheckins = sqliteTable(
  "workout_checkins",
  {
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    groups: text("groups").notNull(),
    checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.date] }),
    index("idx_workout_checkins_user_date").on(table.userId, table.date),
  ],
);
