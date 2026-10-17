CREATE TABLE public.auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_rate_limits TO service_role;

CREATE FUNCTION public.check_auth_rate_limit(p_key TEXT,p_limit INTEGER,p_window_seconds INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE used INTEGER;
BEGIN
  IF LENGTH(p_key)>200 OR p_limit<1 OR p_window_seconds<1 THEN RETURN FALSE; END IF;
  DELETE FROM auth_rate_limits WHERE "windowStartedAt"<NOW()-INTERVAL '1 day';
  INSERT INTO auth_rate_limits(key,attempts,"windowStartedAt") VALUES(p_key,1,NOW())
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN auth_rate_limits."windowStartedAt"<NOW()-make_interval(secs=>p_window_seconds) THEN 1 ELSE auth_rate_limits.attempts+1 END,
    "windowStartedAt"=CASE WHEN auth_rate_limits."windowStartedAt"<NOW()-make_interval(secs=>p_window_seconds) THEN NOW() ELSE auth_rate_limits."windowStartedAt" END
  RETURNING attempts INTO used;
  RETURN used<=p_limit;
END $$;
REVOKE ALL ON FUNCTION public.check_auth_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(TEXT,INTEGER,INTEGER) TO service_role;
