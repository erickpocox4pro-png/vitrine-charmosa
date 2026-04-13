CREATE TABLE public.page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  page_path text NOT NULL DEFAULT '/',
  referrer text DEFAULT '',
  utm_source text DEFAULT '',
  utm_medium text DEFAULT '',
  utm_campaign text DEFAULT '',
  utm_term text DEFAULT '',
  utm_content text DEFAULT '',
  source_label text NOT NULL DEFAULT 'direto',
  user_agent text DEFAULT '',
  session_id text DEFAULT ''
);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visits" ON public.page_visits FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view visits" ON public.page_visits FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_page_visits_created_at ON public.page_visits(created_at DESC);
CREATE INDEX idx_page_visits_source ON public.page_visits(source_label);