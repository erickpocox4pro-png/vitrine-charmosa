
-- 1. CRITICAL: Lock down user_roles - prevent privilege escalation
-- Only admins can manage role assignments
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict coupons: only show active, non-expired coupons publicly
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

CREATE POLICY "Anyone can read active coupons"
ON public.coupons FOR SELECT TO public
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (starts_at IS NULL OR starts_at <= now())
);

-- Admins can still see all coupons
CREATE POLICY "Admins can read all coupons"
ON public.coupons FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Tighten page_visits INSERT - restrict to reasonable usage (keep true but add comment)
-- page_visits INSERT with true is intentional for analytics tracking
-- No change needed here as it's a write-only public table with no sensitive data

-- 4. Restrict pix_payments INSERT to authenticated only (already has auth.uid() = user_id check)
-- Already secure, no change needed
