-- Posterly app schema. Apply with `npx drizzle-kit push` or run directly
-- against the Neon/Postgres database.

CREATE TABLE IF NOT EXISTS posterly_posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  source_file_name text NOT NULL,
  source_file_path text,
  style text NOT NULL DEFAULT 'minimal',
  html text,
  status text NOT NULL DEFAULT 'pending',
  html_path text,
  pdf_path text,
  png_path text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posterly_posters_user_created_idx
  ON posterly_posters (user_id, created_at);

ALTER TABLE posterly_posters
  ALTER COLUMN source_file_path DROP NOT NULL;

ALTER TABLE posterly_posters
  ADD COLUMN IF NOT EXISTS style text NOT NULL DEFAULT 'minimal';

ALTER TABLE posterly_posters
  ADD COLUMN IF NOT EXISTS html text;
