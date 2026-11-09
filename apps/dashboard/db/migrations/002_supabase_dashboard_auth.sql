-- Apply after 001_retail_foundation.sql in the linked Supabase Postgres project.
-- Account roles are assigned once by the auth.users trigger and read from this
-- database table. JWT user_metadata and frontend role state are never authorization.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_user_id_unique
  ON public.tenants (owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dashboard_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('creator', 'retailer')),
  tenant_id uuid UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'creator' AND tenant_id IS NULL) OR (role = 'retailer' AND tenant_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.dashboard_profiles(user_id) ON DELETE CASCADE,
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 1 AND 120),
  channel_url text CHECK (channel_url IS NULL OR length(channel_url) <= 2048),
  biography text CHECK (biography IS NULL OR length(biography) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retailer_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.dashboard_profiles(user_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_name text NOT NULL CHECK (length(trim(business_name)) BETWEEN 1 AND 160),
  website_url text CHECK (website_url IS NULL OR length(website_url) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_bopit_dashboard_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested_role text;
  profile_name text;
  new_tenant_id uuid;
BEGIN
  requested_role := NEW.raw_user_meta_data ->> 'bopit_role';
  IF requested_role IS NULL OR requested_role NOT IN ('creator', 'retailer') THEN
    RAISE EXCEPTION 'Choose a supported BopIt account type.' USING ERRCODE = '23514';
  END IF;

  profile_name := NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), '');
  IF profile_name IS NULL THEN
    profile_name := split_part(COALESCE(NEW.email, 'BopIt user'), '@', 1);
  END IF;
  profile_name := left(profile_name, 120);

  IF requested_role = 'retailer' THEN
    INSERT INTO public.tenants (name, owner_user_id)
      VALUES (left(profile_name, 160), NEW.id)
      RETURNING id INTO new_tenant_id;
  END IF;

  INSERT INTO public.dashboard_profiles (user_id, role, tenant_id, display_name)
    VALUES (NEW.id, requested_role, new_tenant_id, profile_name);

  IF requested_role = 'creator' THEN
    INSERT INTO public.creator_profiles (user_id, public_name)
      VALUES (NEW.id, profile_name);
  ELSE
    INSERT INTO public.retailer_profiles (user_id, tenant_id, business_name)
      VALUES (NEW.id, new_tenant_id, profile_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bopit_dashboard ON auth.users;
CREATE TRIGGER on_auth_user_created_bopit_dashboard
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_bopit_dashboard_profile();

CREATE OR REPLACE FUNCTION public.current_bopit_retail_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id FROM public.dashboard_profiles
  WHERE user_id = auth.uid() AND role = 'retailer'
$$;

REVOKE ALL ON FUNCTION public.create_bopit_dashboard_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_bopit_retail_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_bopit_retail_tenant_id() TO authenticated;

ALTER TABLE public.dashboard_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_profiles_select_self ON public.dashboard_profiles;
CREATE POLICY dashboard_profiles_select_self ON public.dashboard_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS creator_profiles_select_self ON public.creator_profiles;
CREATE POLICY creator_profiles_select_self ON public.creator_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS creator_profiles_update_self ON public.creator_profiles;
CREATE POLICY creator_profiles_update_self ON public.creator_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS retailer_profiles_select_self ON public.retailer_profiles;
CREATE POLICY retailer_profiles_select_self ON public.retailer_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS retailer_profiles_update_self ON public.retailer_profiles;
CREATE POLICY retailer_profiles_update_self ON public.retailer_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND tenant_id = public.current_bopit_retail_tenant_id());

DROP POLICY IF EXISTS tenants_select_owner ON public.tenants;
CREATE POLICY tenants_select_owner ON public.tenants
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- Direct authenticated Supabase access, if enabled by a client, remains tenant scoped.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'products', 'inventory', 'inventory_movements', 'competitor_listings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS bopit_retail_tenant_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY bopit_retail_tenant_access ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_bopit_retail_tenant_id()) WITH CHECK (tenant_id = public.current_bopit_retail_tenant_id())',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;

REVOKE ALL ON public.dashboard_profiles FROM anon, authenticated;
GRANT SELECT ON public.dashboard_profiles TO authenticated;
REVOKE ALL ON public.creator_profiles FROM anon, authenticated;
GRANT SELECT ON public.creator_profiles TO authenticated;
GRANT UPDATE (public_name, channel_url, biography) ON public.creator_profiles TO authenticated;
REVOKE ALL ON public.retailer_profiles FROM anon, authenticated;
GRANT SELECT ON public.retailer_profiles TO authenticated;
GRANT UPDATE (business_name, website_url) ON public.retailer_profiles TO authenticated;
REVOKE ALL ON public.tenants FROM anon, authenticated;
GRANT SELECT ON public.tenants TO authenticated;
