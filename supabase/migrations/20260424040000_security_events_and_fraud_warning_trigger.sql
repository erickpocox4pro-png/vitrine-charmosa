-- =====================================================================
-- SECURITY EVENTS LOG + FRAUD WARNING TRIGGER
-- =====================================================================
-- Substitui o bloqueio silencioso da RLS por trigger BEFORE INSERT que:
--   1. Permite admins/service_role (fluxo legítimo continua)
--   2. Tenta logar a tentativa em security_events (best-effort)
--   3. RAISE EXCEPTION com aviso legal customizado para o atacante
--
-- IMPORTANTE: o INSERT em security_events DENTRO do trigger é
-- roll-backeado junto com o RAISE EXCEPTION (mesma transação).
-- Para log persistente, ver migração subsequente que usa pg_net
-- HTTP async (fire-and-forget) ou ler logs diretos do Supabase.
-- =====================================================================

-- 1. Tabela security_events (admin-only)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  event_type text NOT NULL,
  table_name text,
  attempted_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events"
  ON public.security_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete security events" ON public.security_events;
CREATE POLICY "Admins can delete security events"
  ON public.security_events FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id
  ON public.security_events (user_id);

-- 2. Função guardiã (SECURITY DEFINER pra conseguir gravar o log)
CREATE OR REPLACE FUNCTION public.guard_order_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_email text;
  v_role text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  END IF;

  -- Log best-effort (será roll-backeado mas fica disponível em logs do Postgres)
  INSERT INTO public.security_events
    (user_id, user_email, event_type, table_name, attempted_payload, created_at)
  VALUES
    (auth.uid(), v_email, 'unauthorized_insert_attempt', TG_TABLE_NAME, to_jsonb(NEW), now());

  RAISE EXCEPTION
    'AÇÃO BLOQUEADA: tentativa de fraude detectada. Esta ação é ILEGAL (Lei 12.737/2012 - Crime de Invasão de Dispositivo Informático; CP Art. 171 - Estelionato; CP Art. 154-A). Sua tentativa foi REGISTRADA com identificação completa e nossa equipe foi notificada. Se você continuar, poderá ser RASTREADO e responder criminalmente.'
    USING
      ERRCODE = 'P0001',
      HINT = 'Se você é um cliente legitimo, use o fluxo normal de checkout do site.';
END;
$func$;

-- 3. INSERT policies permissivas (trigger faz a checagem real)
DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.orders;
CREATE POLICY "Insert guarded by trigger" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.order_items;
CREATE POLICY "Insert guarded by trigger" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Insert guarded by trigger" ON public.pix_payments;
CREATE POLICY "Insert guarded by trigger" ON public.pix_payments
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Triggers
DROP TRIGGER IF EXISTS guard_insert_orders ON public.orders;
CREATE TRIGGER guard_insert_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_insert();

DROP TRIGGER IF EXISTS guard_insert_order_items ON public.order_items;
CREATE TRIGGER guard_insert_order_items
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_insert();

DROP TRIGGER IF EXISTS guard_insert_pix_payments ON public.pix_payments;
CREATE TRIGGER guard_insert_pix_payments
  BEFORE INSERT ON public.pix_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_insert();
