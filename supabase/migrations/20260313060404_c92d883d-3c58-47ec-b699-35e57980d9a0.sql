
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pix payments" ON public.pix_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pix payments" ON public.pix_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all pix payments" ON public.pix_payments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update pix payments" ON public.pix_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
