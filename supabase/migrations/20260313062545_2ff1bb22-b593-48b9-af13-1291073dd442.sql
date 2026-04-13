
-- Tabela de cupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed'
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_value numeric DEFAULT 0,
  max_discount numeric DEFAULT NULL,
  usage_limit integer DEFAULT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT NULL,
  category_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update coupons" ON public.coupons FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete coupons" ON public.coupons FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
