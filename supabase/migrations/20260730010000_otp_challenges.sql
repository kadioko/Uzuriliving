CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_challenges_expires_at_idx ON public.otp_challenges (expires_at);
