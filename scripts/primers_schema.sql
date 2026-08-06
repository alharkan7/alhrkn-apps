-- Primer app schema
-- Mirror of the `primers` Drizzle table in src/db/schema.ts.
-- Apply with: npx drizzle-kit push   (preferred), or run this file against the Neon DB.

CREATE TABLE IF NOT EXISTS "primers" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "parent_id" text REFERENCES "primers"("id") ON DELETE SET NULL,
  "topic" text NOT NULL,
  "title" text,
  "content" text,
  "glossary" jsonb DEFAULT '[]'::jsonb,
  "options" jsonb DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "primers"
  ADD COLUMN IF NOT EXISTS "parent_id" text REFERENCES "primers"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "primers_user_parent_created_idx"
  ON "primers" ("user_id", "parent_id", "created_at");

CREATE TABLE IF NOT EXISTS "primer_explanations" (
  "id" text PRIMARY KEY,
  "primer_id" text NOT NULL REFERENCES "primers"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL,
  "selection" text NOT NULL,
  "selection_key" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'generating',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "primer_explanations_lookup_idx"
  ON "primer_explanations" ("primer_id", "selection_key");
