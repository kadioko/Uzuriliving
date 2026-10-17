-- The application authenticates through the Edge API, which uses service_role.
-- Public catalog reads also go through that API. Browser database roles must
-- never read PIN hashes, customer records, or write stock directly.
DO $$
DECLARE app_table RECORD;
BEGIN
  FOR app_table IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', app_table.tablename);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', app_table.tablename);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
