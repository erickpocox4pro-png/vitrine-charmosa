
-- Add new columns to products table for complete product management
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS short_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS width numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS length numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords text DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bestseller boolean DEFAULT false;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products(slug) WHERE slug IS NOT NULL AND slug != '';

-- Create unique index on sku
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products(sku) WHERE sku IS NOT NULL AND sku != '';

-- Add subcategories table
CREATE TABLE IF NOT EXISTS public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  image_url text DEFAULT '',
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  meta_title text DEFAULT '',
  meta_description text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories viewable by everyone" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Admins can insert subcategories" ON public.subcategories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update subcategories" ON public.subcategories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete subcategories" ON public.subcategories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add subcategory_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Add description and image columns to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_description text DEFAULT '';
