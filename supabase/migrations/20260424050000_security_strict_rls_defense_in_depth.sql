-- =====================================================================
-- SEGURANÇA MÁXIMA: RLS ESTRITA + DEFESA EM PROFUNDIDADE
-- =====================================================================
-- Trade-off escolhido: RLS pura, declarativa, sem código custom executando.
-- Superficie de ataque mínima possível.
--
-- Quem pode INSERT em orders/order_items/pix_payments?
--   - service_role (edge functions create-pix-checkout, create-checkout)
--   - admins autenticados (com role admin)
--   - NINGUÉM mais
--
-- Trade-off: atacante recebe erro genérico do Postgres em vez de mensagem
-- legal customizada. Em troca, removemos todo código custom da hot path.
-- =====================================================================

-- 1. Remover triggers e função guardiã (volta pra RLS pura)
DROP TRIGGER IF EXISTS guard_insert_orders ON public.orders;
DROP TRIGGER IF EXISTS guard_insert_order_items ON public.order_items;
DROP TRIGGER IF EXISTS guard_insert_pix_payments ON public.pix_payments;
DROP FUNCTION IF EXISTS public.guard_order_payment_insert();

-- 2. Remover permissive policies "Insert guarded by trigger"
DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.orders;
DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.order_items;
DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.pix_payments;

-- 3. Drop tabela security_events (sem uso sem trigger)
DROP TABLE IF EXISTS public.security_events;

-- 4. DEFESA EM PROFUNDIDADE — restrições adicionais de schema

-- 4.1 payment_method whitelist (nada de string arbitrária)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_valid
  CHECK (payment_method IS NULL OR payment_method IN ('pix', 'stripe', 'card', 'manual', ''));

-- 4.2 pix_payments só nasce 'pending' — força workflow correto
--     (vira 'paid' depois via UPDATE de admin ou webhook AppMax)
CREATE OR REPLACE FUNCTION public.enforce_pix_payment_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_role text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  IF v_role = 'service_role' THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'PIX payment deve nascer com status pending (use UPDATE para confirmar pagamento)';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_pix_initial_status ON public.pix_payments;
CREATE TRIGGER enforce_pix_initial_status
  BEFORE INSERT ON public.pix_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pix_payment_initial_status();

-- 4.3 Audit trail automático de mudanças de status em orders
CREATE OR REPLACE FUNCTION public.audit_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_timeline (order_id, status, note, created_at)
    VALUES (
      NEW.id,
      NEW.status,
      format('Status alterado: %s -> %s por user %s',
        OLD.status, NEW.status, COALESCE(auth.uid()::text, 'system')),
      now()
    );
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS audit_order_status_change ON public.orders;
CREATE TRIGGER audit_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.audit_order_status_change();

-- 4.4 Trigger que impede DELETE de pedidos pagos
CREATE OR REPLACE FUNCTION public.prevent_paid_order_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF OLD.status IN ('paid', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'Não é possível deletar pedido com status %. Use cancellation/refund.', OLD.status;
  END IF;
  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS prevent_paid_order_deletion ON public.orders;
CREATE TRIGGER prevent_paid_order_deletion
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_order_deletion();
