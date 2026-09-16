import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      tech_id TEXT UNIQUE,
      one_signal_token TEXT
    );

    CREATE TABLE IF NOT EXISTS qc_periods (
      id SERIAL PRIMARY KEY,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      created_by_id INTEGER NOT NULL REFERENCES users(id),
      required_qcs INTEGER NOT NULL DEFAULT 4,
      is_active BOOLEAN NOT NULL DEFAULT false,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS qc_submissions (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES users(id),
      period_id INTEGER NOT NULL REFERENCES qc_periods(id),
      job_id TEXT NOT NULL,
      address TEXT NOT NULL,
      tap_image TEXT NOT NULL,
      ground_block_image TEXT,
      bonding_image TEXT,
      house_image TEXT NOT NULL,
      job_screenshot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      supervisor_comment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS status_icons (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon_path TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS qc_submissions_technician_id_idx ON qc_submissions(technician_id);
    CREATE INDEX IF NOT EXISTS qc_submissions_period_id_idx ON qc_submissions(period_id);
    CREATE INDEX IF NOT EXISTS qc_submissions_status_idx ON qc_submissions(status);
  `);
}
