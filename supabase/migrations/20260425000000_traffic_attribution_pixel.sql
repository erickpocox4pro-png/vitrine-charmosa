-- =========================================================================
-- Atribuição de tráfego completa + Pixel do Facebook / Google Ads
-- =========================================================================
-- 1. Enriquece page_visits com fbclid/gclid/landing/first_visit
-- 2. Cria attribution_sessions (first-touch + last-touch por session_id)
-- 3. Adiciona campos de atribuição em orders (pra casar venda com fonte)
-- 4. Cria tabela conversion_events (PageView, ViewContent, AddToCart, etc.)
-- =========================================================================

-- 1) Enriquecer page_visits ---------------------------------------------------
ALTER TABLE public.page_visits
  ADD COLUMN IF NOT EXISTS fbclid text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gclid text DEFAULT '',
  ADD COLUMN IF NOT EXISTS landing_path text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_first_visit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_page_visits_fbclid ON public.page_visits(fbclid) WHERE fbclid <> '';
CREATE INDEX IF NOT EXISTS idx_page_visits_gclid ON public.page_visits(gclid) WHERE gclid <> '';
CREATE INDEX IF NOT EXISTS idx_page_visits_session ON public.page_visits(session_id);

-- 2) Tabela attribution_sessions ---------------------------------------------
-- Uma linha por session_id armazena first-touch (origem original) e last-touch
CREATE TABLE IF NOT EXISTS public.attribution_sessions (
  session_id text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),

  -- First-touch (origem original do lead)
  first_source       text NOT NULL DEFAULT 'direto',
  first_utm_source   text DEFAULT '',
  first_utm_medium   text DEFAULT '',
  first_utm_campaign text DEFAULT '',
  first_utm_term     text DEFAULT '',
  first_utm_content  text DEFAULT '',
  first_referrer     text DEFAULT '',
  first_landing_path text DEFAULT '',
  first_fbclid       text DEFAULT '',
  first_gclid        text DEFAULT '',

  -- Last-touch (a fonte da SESSÃO atual — pode mudar em próximas sessões do mesmo user)
  last_source        text NOT NULL DEFAULT 'direto',
  last_utm_source    text DEFAULT '',
  last_utm_medium    text DEFAULT '',
  last_utm_campaign  text DEFAULT '',
  last_referrer      text DEFAULT '',
  last_fbclid        text DEFAULT '',
  last_gclid        text DEFAULT '',

  visits_count int NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.attribution_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert attribution sessions"
  ON public.attribution_sessions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update own session"
  ON public.attribution_sessions FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view attribution sessions"
  ON public.attribution_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_attr_sess_first_source ON public.attribution_sessions(first_source);
CREATE INDEX IF NOT EXISTS idx_attr_sess_first_seen ON public.attribution_sessions(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_sess_user ON public.attribution_sessions(user_id);

-- 3) Atribuição em orders ----------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS attribution_session_id text,
  ADD COLUMN IF NOT EXISTS utm_source   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign text DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fbclid       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gclid        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_first text DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_last  text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_orders_source_first ON public.orders(source_first);
CREATE INDEX IF NOT EXISTS idx_orders_source_last  ON public.orders(source_last);
CREATE INDEX IF NOT EXISTS idx_orders_attr_session ON public.orders(attribution_session_id);

-- 4) conversion_events (eventos client-side: ViewContent, AddToCart, etc.) ---
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text DEFAULT '',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,           -- PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Lead
  event_value numeric DEFAULT 0,
  currency text DEFAULT 'BRL',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  source_label text DEFAULT '',
  fbclid text DEFAULT '',
  gclid  text DEFAULT '',
  meta jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert conversion events"
  ON public.conversion_events FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admins view conversion events"
  ON public.conversion_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_conv_events_created ON public.conversion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_events_event ON public.conversion_events(event_name);
CREATE INDEX IF NOT EXISTS idx_conv_events_session ON public.conversion_events(session_id);
