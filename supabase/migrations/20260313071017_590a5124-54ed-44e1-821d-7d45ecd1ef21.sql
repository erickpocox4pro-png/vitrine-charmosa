
-- Import jobs tracking table
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_name text,
  total_items integer DEFAULT 0,
  created_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Import job items for line-by-line audit and rollback
CREATE TABLE public.import_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  line_number integer,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import jobs" ON public.import_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage import job items" ON public.import_job_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
