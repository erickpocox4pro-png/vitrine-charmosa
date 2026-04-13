
-- Shipping rules table
CREATE TABLE public.shipping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name text NOT NULL,
  cep_start text NOT NULL,
  cep_end text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  delivery_days_min integer NOT NULL DEFAULT 3,
  delivery_days_max integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping rules viewable by everyone" ON public.shipping_rules
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage shipping rules" ON public.shipping_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with current hardcoded rules
INSERT INTO public.shipping_rules (region_name, cep_start, cep_end, price, is_free, delivery_days_min, delivery_days_max, sort_order) VALUES
  ('Messias - AL', '57990', '57999', 0, true, 1, 2, 1),
  ('Alagoas', '57000', '57989', 10, false, 2, 4, 2),
  ('Pernambuco', '50000', '56999', 11, false, 3, 5, 3),
  ('Sergipe', '49000', '49999', 12, false, 3, 5, 4),
  ('Paraíba', '58000', '58999', 12, false, 3, 5, 5),
  ('Bahia', '40000', '48999', 13, false, 3, 6, 6),
  ('Rio Grande do Norte', '59000', '59999', 13, false, 4, 6, 7),
  ('Ceará', '60000', '63999', 14, false, 4, 7, 8),
  ('Piauí', '64000', '64999', 15, false, 5, 8, 9),
  ('Maranhão', '65000', '65999', 16, false, 5, 8, 10),
  ('São Paulo - Capital', '01000', '09999', 15, false, 5, 8, 11),
  ('São Paulo - Interior', '10000', '19999', 17, false, 6, 10, 12),
  ('Rio de Janeiro', '20000', '28999', 25, false, 5, 9, 13),
  ('Minas Gerais / Espírito Santo', '29000', '39999', 22, false, 5, 9, 14),
  ('Norte', '66000', '69999', 28, false, 7, 12, 15),
  ('Centro-Oeste / Paraná', '70000', '87999', 25, false, 6, 10, 16),
  ('Sul', '88000', '99999', 25, false, 6, 10, 17);
