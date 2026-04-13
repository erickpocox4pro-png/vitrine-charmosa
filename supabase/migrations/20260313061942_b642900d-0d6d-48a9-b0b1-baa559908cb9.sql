
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default settings
INSERT INTO public.site_settings (key, value) VALUES
  ('slideshow', '{"duration": 5000, "speed": 800, "images": []}'),
  ('fonts', '{"heading": "Playfair Display", "body": "Montserrat"}'),
  ('colors', '{"primary": "14 45% 68%", "secondary": "15 53% 94%", "background": "0 0% 98%", "foreground": "0 0% 10%", "accent": "15 53% 94%", "muted": "15 20% 94%"}')
ON CONFLICT (key) DO NOTHING;
