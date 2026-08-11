-- Emergency/durable Supabase hardening for server-owned application tables.
--
-- The application accesses business data with DATABASE_URL on the server and
-- uses Supabase's publishable client only for Auth. Enabling RLS without public
-- policies therefore blocks anon/authenticated Data API access without changing
-- the server-side application behavior.
--
-- This block is intentionally catalog-driven so it also covers public tables
-- created before they were represented in src/db/schema.ts.
DO $rls$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_record.relname
    );
  END LOOP;
END
$rls$;
