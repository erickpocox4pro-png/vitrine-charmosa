
-- Add columns to orders for admin management
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}';

-- Allow admins to view ALL orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update orders (status, tracking, notes)
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL order items
CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Create order_timeline table for status history
CREATE TABLE IF NOT EXISTS public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  note text DEFAULT '',
  admin_email text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order timeline" ON public.order_timeline FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert order timeline" ON public.order_timeline FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own order timeline" ON public.order_timeline FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_timeline.order_id AND orders.user_id = auth.uid())
);
