import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  techId: text("tech_id").unique(),
  oneSignalToken: text("one_signal_token"),
});

export const qcPeriods = pgTable("qc_periods", {
  id: serial("id").primaryKey(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id),
  requiredQCs: integer("required_qcs").notNull().default(4),
  isActive: boolean("is_active").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qcSubmissions = pgTable("qc_submissions", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id")
    .notNull()
    .references(() => users.id),
  periodId: integer("period_id")
    .notNull()
    .references(() => qcPeriods.id),
  jobId: text("job_id").notNull(),
  address: text("address").notNull(),
  tapImage: text("tap_image").notNull(),
  groundBlockImage: text("ground_block_image"),
  bondingImage: text("bonding_image"),
  houseImage: text("house_image").notNull(),
  jobScreenshot: text("job_screenshot").notNull(),
  status: text("status").notNull().default("pending"),
  supervisorComment: text("supervisor_comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const statusIcons = pgTable("status_icons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  iconPath: text("icon_path").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  periods: many(qcPeriods),
  submissions: many(qcSubmissions),
}));

export const qcPeriodsRelations = relations(qcPeriods, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [qcPeriods.createdById],
    references: [users.id],
  }),
  submissions: many(qcSubmissions),
}));

export const qcSubmissionsRelations = relations(qcSubmissions, ({ one }) => ({
  technician: one(users, {
    fields: [qcSubmissions.technicianId],
    references: [users.id],
  }),
  period: one(qcPeriods, {
    fields: [qcSubmissions.periodId],
    references: [qcPeriods.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertQCPeriodSchema = createInsertSchema(qcPeriods, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).omit({ id: true, createdAt: true });
export const insertQCSubmissionSchema = createInsertSchema(qcSubmissions).omit({
  id: true,
  status: true,
  supervisorComment: true,
  createdAt: true,
});
export const insertStatusIconSchema = createInsertSchema(statusIcons).omit({
  id: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const reviewQCSchema = z.object({
  qcId: z.coerce.number().int().positive(),
  status: z.enum(["approved", "declined"]),
  comment: z.string().optional(),
});

export const addTechnicianSchema = z.object({
  username: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  techId: z.string().regex(/^\d{4}$/),
});

export const deleteTechnicianSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type QCPeriod = typeof qcPeriods.$inferSelect;
export type InsertQCPeriod = typeof qcPeriods.$inferInsert;
export type QCSubmission = typeof qcSubmissions.$inferSelect;
export type InsertQCSubmission = typeof qcSubmissions.$inferInsert;
export type StatusIcon = typeof statusIcons.$inferSelect;
export type InsertStatusIcon = typeof statusIcons.$inferInsert;
