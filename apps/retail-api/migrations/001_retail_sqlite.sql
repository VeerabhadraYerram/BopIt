PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku TEXT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  brand TEXT,
  category TEXT,
  category_id TEXT,
  attributes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories(tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_unique
  ON products (tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_tenant_title_idx ON products (tenant_id, title);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location TEXT NOT NULL,
  quantity_on_hand REAL NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved REAL NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  available_quantity REAL GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_threshold REAL CHECK (reorder_threshold IS NULL OR reorder_threshold >= 0),
  unit_cost REAL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  currency TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CHECK (quantity_reserved <= quantity_on_hand),
  CHECK ((unit_cost IS NULL AND currency IS NULL) OR
         (unit_cost IS NOT NULL AND length(currency) = 3 AND currency = upper(currency))),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, product_id, location)
);
CREATE INDEX IF NOT EXISTS inventory_tenant_stock_idx ON inventory (tenant_id, available_quantity);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  inventory_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'removal', 'adjustment')),
  quantity_delta REAL NOT NULL CHECK (quantity_delta <> 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id, inventory_id) REFERENCES inventory(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS inventory_movements_tenant_created_idx
  ON inventory_movements (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  status TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  source_fingerprint TEXT NOT NULL,
  import_job_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, external_id),
  FOREIGN KEY (tenant_id, import_job_id) REFERENCES import_jobs(tenant_id, id)
);
CREATE INDEX IF NOT EXISTS sales_transactions_tenant_date_idx
  ON sales_transactions (tenant_id, transaction_date DESC);

CREATE TABLE IF NOT EXISTS sales_line_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  line_total REAL NOT NULL CHECK (line_total >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  source_row INTEGER NOT NULL,
  FOREIGN KEY (tenant_id, transaction_id) REFERENCES sales_transactions(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id),
  UNIQUE (tenant_id, transaction_id, source_row)
);
CREATE INDEX IF NOT EXISTS sales_line_items_tenant_product_idx
  ON sales_line_items (tenant_id, product_id);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dataset TEXT NOT NULL CHECK (dataset IN ('products', 'inventory', 'sales')),
  file_name TEXT NOT NULL,
  file_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preview', 'completed', 'partial', 'duplicate')),
  source_rows INTEGER NOT NULL CHECK (source_rows >= 0),
  imported_rows INTEGER NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  updated_rows INTEGER NOT NULL DEFAULT 0 CHECK (updated_rows >= 0),
  skipped_rows INTEGER NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  rejected_rows INTEGER NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT,
  UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS import_jobs_tenant_started_idx
  ON import_jobs (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS import_preview_rows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  import_job_id TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  valid INTEGER NOT NULL CHECK (valid IN (0, 1)),
  errors TEXT NOT NULL,
  mapped TEXT NOT NULL,
  FOREIGN KEY (tenant_id, import_job_id) REFERENCES import_jobs(tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, import_job_id, source_row)
);
CREATE INDEX IF NOT EXISTS import_preview_job_row_idx
  ON import_preview_rows (tenant_id, import_job_id, source_row);

CREATE TABLE IF NOT EXISTS competitor_listings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id TEXT,
  provider TEXT NOT NULL,
  provider_listing_id TEXT NOT NULL,
  title TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  retailer TEXT NOT NULL,
  price REAL CHECK (price IS NULL OR price >= 0),
  currency TEXT,
  availability TEXT,
  listing_url TEXT,
  attributes TEXT NOT NULL DEFAULT '{}',
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id) ON DELETE CASCADE,
  CHECK ((price IS NULL AND currency IS NULL) OR
         (price IS NOT NULL AND length(currency) = 3 AND currency = upper(currency))),
  UNIQUE (tenant_id, provider, provider_listing_id)
);
