
-- 1. Create product_costs table (admin-only)
CREATE TABLE public.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  cost numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product costs"
ON public.product_costs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing cost data
INSERT INTO public.product_costs (product_id, cost)
SELECT id, cost FROM public.products WHERE cost IS NOT NULL;

-- Drop cost column from products
ALTER TABLE public.products DROP COLUMN cost;

-- 2. Create validate_coupon RPC (returns only validity info for a given code)
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _order_total numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon RECORD;
  _result jsonb;
BEGIN
  SELECT * INTO _coupon FROM public.coupons
  WHERE code = upper(_code) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom não encontrado ou inválido.');
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este cupom expirou.');
  END IF;

  IF _coupon.starts_at IS NOT NULL AND _coupon.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este cupom ainda não está ativo.');
  END IF;

  IF _coupon.usage_limit IS NOT NULL AND _coupon.usage_count >= _coupon.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este cupom atingiu o limite de uso.');
  END IF;

  IF _coupon.min_order_value IS NOT NULL AND _order_total < _coupon.min_order_value THEN
    RETURN jsonb_build_object('valid', false, 'error',
      format('Pedido mínimo de R$ %s para usar este cupom.', to_char(_coupon.min_order_value, 'FM999990D00')));
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', _coupon.id,
    'code', _coupon.code,
    'discount_type', _coupon.discount_type,
    'discount_value', _coupon.discount_value,
    'max_discount', _coupon.max_discount,
    'applies_to', _coupon.applies_to,
    'min_order_value', _coupon.min_order_value
  );
END;
$$;

-- 3. Remove public SELECT on coupons (keep admin-only)
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
