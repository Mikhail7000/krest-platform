-- Support requests table for non-authenticated users to contact super admin
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT,
  telegram_username TEXT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Only super_admin can SELECT or UPDATE
CREATE POLICY "super_admin_all" ON public.support_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- CREATE INDEX for faster queries
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON public.support_requests(status);
CREATE INDEX IF NOT EXISTS support_requests_created_at_idx ON public.support_requests(created_at DESC);
