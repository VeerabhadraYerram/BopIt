-- Dashboard-only demo fixtures. These tables are intentionally separate from
-- Channel3 responses and the retailer CSV sales/import pipeline.

CREATE TABLE IF NOT EXISTS public.dashboard_demo_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_key text NOT NULL,
  creator_user_id uuid REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  retailer_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  canonical_product_id text NOT NULL,
  title text NOT NULL,
  brand text,
  category text,
  selected_variant jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(selected_variant) = 'object'),
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((creator_user_id IS NOT NULL) <> (retailer_tenant_id IS NOT NULL)),
  UNIQUE (id, creator_user_id),
  UNIQUE (id, retailer_tenant_id),
  UNIQUE (id, creator_user_id, retailer_tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_demo_products_creator_key
  ON public.dashboard_demo_products (creator_user_id, demo_key) WHERE creator_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_demo_products_retailer_key
  ON public.dashboard_demo_products (retailer_tenant_id, demo_key) WHERE retailer_tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dashboard_demo_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  demo_key text NOT NULL,
  title text NOT NULL,
  platform text NOT NULL DEFAULT 'demo',
  video_url text NOT NULL,
  published_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  UNIQUE (id, creator_user_id),
  UNIQUE (creator_user_id, demo_key)
);

CREATE TABLE IF NOT EXISTS public.dashboard_demo_detected_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  video_id uuid NOT NULL,
  demo_key text NOT NULL,
  timestamp_ms integer NOT NULL CHECK (timestamp_ms >= 0),
  label text NOT NULL,
  category text,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  product_id uuid,
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  UNIQUE (id, creator_user_id),
  UNIQUE (id, creator_user_id, video_id),
  UNIQUE (id, creator_user_id, product_id),
  UNIQUE (creator_user_id, demo_key),
  FOREIGN KEY (video_id, creator_user_id) REFERENCES public.dashboard_demo_videos(id, creator_user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, creator_user_id) REFERENCES public.dashboard_demo_products(id, creator_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.dashboard_demo_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  demo_key text NOT NULL,
  video_id uuid NOT NULL,
  detected_object_id uuid,
  product_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('product_search', 'product_click')),
  occurred_at timestamptz NOT NULL,
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  UNIQUE (id, creator_user_id),
  UNIQUE (id, creator_user_id, product_id),
  UNIQUE (creator_user_id, demo_key),
  FOREIGN KEY (video_id, creator_user_id) REFERENCES public.dashboard_demo_videos(id, creator_user_id) ON DELETE CASCADE,
  FOREIGN KEY (detected_object_id, creator_user_id, video_id) REFERENCES public.dashboard_demo_detected_objects(id, creator_user_id, video_id) ON DELETE CASCADE,
  FOREIGN KEY (detected_object_id, creator_user_id, product_id) REFERENCES public.dashboard_demo_detected_objects(id, creator_user_id, product_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, creator_user_id) REFERENCES public.dashboard_demo_products(id, creator_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.dashboard_demo_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  demo_key text NOT NULL,
  engagement_event_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  attributed_at timestamptz NOT NULL,
  attribution_basis text NOT NULL DEFAULT 'demo_fixture' CHECK (attribution_basis = 'demo_fixture'),
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  UNIQUE (creator_user_id, demo_key),
  FOREIGN KEY (engagement_event_id, creator_user_id, product_id)
    REFERENCES public.dashboard_demo_engagement_events(id, creator_user_id, product_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, creator_user_id) REFERENCES public.dashboard_demo_products(id, creator_user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.dashboard_demo_seller_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_key text NOT NULL,
  product_id uuid NOT NULL,
  creator_user_id uuid REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  retailer_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(14,2) CHECK (compare_at_price IS NULL OR compare_at_price >= price),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  availability text NOT NULL CHECK (availability IN ('InStock', 'OutOfStock')),
  condition text NOT NULL,
  offer_url text NOT NULL,
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  CHECK ((creator_user_id IS NOT NULL) <> (retailer_tenant_id IS NOT NULL)),
  UNIQUE (id, creator_user_id),
  UNIQUE (id, retailer_tenant_id),
  UNIQUE (creator_user_id, demo_key),
  UNIQUE (retailer_tenant_id, demo_key),
  FOREIGN KEY (product_id, creator_user_id)
    REFERENCES public.dashboard_demo_products(id, creator_user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, retailer_tenant_id)
    REFERENCES public.dashboard_demo_products(id, retailer_tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.dashboard_demo_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_key text NOT NULL,
  offer_id uuid NOT NULL,
  creator_user_id uuid REFERENCES public.creator_profiles(user_id) ON DELETE CASCADE,
  retailer_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
  source text NOT NULL DEFAULT 'mock_demo' CHECK (source = 'mock_demo'),
  CHECK ((creator_user_id IS NOT NULL) <> (retailer_tenant_id IS NOT NULL)),
  UNIQUE (creator_user_id, demo_key),
  UNIQUE (retailer_tenant_id, demo_key),
  FOREIGN KEY (offer_id, creator_user_id)
    REFERENCES public.dashboard_demo_seller_offers(id, creator_user_id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id, retailer_tenant_id)
    REFERENCES public.dashboard_demo_seller_offers(id, retailer_tenant_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.current_bopit_dashboard_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.dashboard_profiles WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_bopit_dashboard_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_bopit_dashboard_role() TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'dashboard_demo_products', 'dashboard_demo_videos', 'dashboard_demo_detected_objects',
    'dashboard_demo_engagement_events', 'dashboard_demo_purchases',
    'dashboard_demo_seller_offers', 'dashboard_demo_price_history'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS dashboard_demo_products_owner_read ON public.dashboard_demo_products;
CREATE POLICY dashboard_demo_products_owner_read ON public.dashboard_demo_products FOR SELECT TO authenticated
  USING ((creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator')
      OR (retailer_tenant_id = public.current_bopit_retail_tenant_id() AND public.current_bopit_dashboard_role() = 'retailer'));

DROP POLICY IF EXISTS dashboard_demo_videos_owner_read ON public.dashboard_demo_videos;
CREATE POLICY dashboard_demo_videos_owner_read ON public.dashboard_demo_videos FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator');

DROP POLICY IF EXISTS dashboard_demo_objects_owner_read ON public.dashboard_demo_detected_objects;
CREATE POLICY dashboard_demo_objects_owner_read ON public.dashboard_demo_detected_objects FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator');

DROP POLICY IF EXISTS dashboard_demo_events_owner_read ON public.dashboard_demo_engagement_events;
CREATE POLICY dashboard_demo_events_owner_read ON public.dashboard_demo_engagement_events FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator');

DROP POLICY IF EXISTS dashboard_demo_purchases_owner_read ON public.dashboard_demo_purchases;
CREATE POLICY dashboard_demo_purchases_owner_read ON public.dashboard_demo_purchases FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator');

DROP POLICY IF EXISTS dashboard_demo_offers_owner_read ON public.dashboard_demo_seller_offers;
CREATE POLICY dashboard_demo_offers_owner_read ON public.dashboard_demo_seller_offers FOR SELECT TO authenticated
  USING ((creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator')
      OR (retailer_tenant_id = public.current_bopit_retail_tenant_id() AND public.current_bopit_dashboard_role() = 'retailer'));

DROP POLICY IF EXISTS dashboard_demo_price_history_owner_read ON public.dashboard_demo_price_history;
CREATE POLICY dashboard_demo_price_history_owner_read ON public.dashboard_demo_price_history FOR SELECT TO authenticated
  USING ((creator_user_id = auth.uid() AND public.current_bopit_dashboard_role() = 'creator')
      OR (retailer_tenant_id = public.current_bopit_retail_tenant_id() AND public.current_bopit_dashboard_role() = 'retailer'));
