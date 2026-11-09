CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku text,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  brand text,
  category text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX products_tenant_sku_unique
  ON products (tenant_id, sku)
  WHERE sku IS NOT NULL;
CREATE INDEX products_tenant_title_idx ON products (tenant_id, title);

CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  location text NOT NULL DEFAULT 'Unspecified',
  quantity_on_hand numeric(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved numeric(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  available_quantity numeric(14, 3) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_threshold numeric(14, 3) CHECK (reorder_threshold IS NULL OR reorder_threshold >= 0),
  unit_cost numeric(14, 4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  currency char(3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CHECK (quantity_reserved <= quantity_on_hand),
  CHECK ((unit_cost IS NULL AND currency IS NULL) OR
         (unit_cost IS NOT NULL AND currency ~ '^[A-Z]{3}$')),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, product_id, location)
);
CREATE INDEX inventory_tenant_stock_idx ON inventory (tenant_id, available_quantity);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  inventory_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'removal', 'adjustment')),
  quantity_delta numeric(14, 3) NOT NULL CHECK (quantity_delta <> 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, inventory_id) REFERENCES inventory(tenant_id, id) ON DELETE CASCADE,
  CHECK ((movement_type = 'receipt' AND quantity_delta > 0) OR
         (movement_type = 'removal' AND quantity_delta < 0) OR
         movement_type = 'adjustment')
);
CREATE INDEX inventory_movements_tenant_created_idx
  ON inventory_movements (tenant_id, created_at DESC);
CREATE INDEX inventory_movements_inventory_idx
  ON inventory_movements (tenant_id, inventory_id, created_at DESC);

CREATE TABLE competitor_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid,
  provider text NOT NULL,
  provider_listing_id text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  brand text,
  category text,
  retailer text NOT NULL,
  price numeric(14, 4) CHECK (price IS NULL OR price >= 0),
  currency char(3),
  availability text,
  listing_url text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE SET NULL (product_id),
  CHECK ((price IS NULL AND currency IS NULL) OR
         (price IS NOT NULL AND currency ~ '^[A-Z]{3}$')),
  UNIQUE (tenant_id, provider, provider_listing_id)
);
CREATE INDEX competitor_listings_tenant_observed_idx
  ON competitor_listings (tenant_id, observed_at DESC);
CREATE INDEX competitor_listings_tenant_product_idx
  ON competitor_listings (tenant_id, product_id);
