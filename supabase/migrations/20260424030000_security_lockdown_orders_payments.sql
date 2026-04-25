-- =====================================================================
-- SECURITY HARDENING: orders, order_items, pix_payments
-- =====================================================================
-- Vetor de ataque corrigido: cliente conseguia inserir registros
-- direto via supabase-js (bypass das edge functions) com qualquer
-- total, status, amount. Resultado: pedido R$0,00 marcado "Pago"
-- foi criado pelo console do navegador.
--
-- Estratégia: remover INSERT policies de usuários comuns.
-- Apenas service_role (das edge functions create-pix-checkout
-- e create-checkout) e admins podem criar pedidos. service_role
-- bypassa RLS automaticamente — não precisa de policy explícita.
-- =====================================================================

-- 1. Remover INSERT policies abertas
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert own pix payments" ON public.pix_payments;

-- 2. Defesa em profundidade: CHECK constraints
ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_non_negative CHECK (total >= 0);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_cost_non_negative
  CHECK (shipping_cost IS NULL OR shipping_cost >= 0);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_valid
  CHECK (status IN (
    'pending', 'paid', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded', 'failed', 'expired'
  ));

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_qty_positive CHECK (quantity > 0);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_price_non_negative CHECK (price >= 0);

ALTER TABLE public.pix_payments
  ADD CONSTRAINT pix_payments_amount_non_negative CHECK (amount >= 0);

ALTER TABLE public.pix_payments
  ADD CONSTRAINT pix_payments_status_valid
  CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed'));

-- 3. Limpeza do pedido fraudulento usado no teste de invasão
DELETE FROM public.pix_payments
  WHERE order_id = 'acf1e7cc-1449-4592-a1de-a40c03d1cfe0';
DELETE FROM public.order_items
  WHERE order_id = 'acf1e7cc-1449-4592-a1de-a40c03d1cfe0';
DELETE FROM public.order_timeline
  WHERE order_id = 'acf1e7cc-1449-4592-a1de-a40c03d1cfe0';
DELETE FROM public.orders
  WHERE id = 'acf1e7cc-1449-4592-a1de-a40c03d1cfe0';

-- 4. Policies admin para suportar AdminOrders.tsx (vendas manuais, etc)
CREATE POLICY "Admins can insert pix payments" ON public.pix_payments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete order items" ON public.order_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pix payments" ON public.pix_payments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
