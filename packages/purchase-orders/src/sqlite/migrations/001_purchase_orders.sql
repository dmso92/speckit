PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY NOT NULL,
  order_number TEXT NOT NULL UNIQUE CHECK(length(trim(order_number)) > 0),
  branch_id TEXT NOT NULL CHECK(length(trim(branch_id)) > 0),
  supplier_id TEXT NOT NULL CHECK(length(trim(supplier_id)) > 0),
  created_by TEXT NOT NULL CHECK(length(trim(created_by)) > 0),
  status TEXT NOT NULL CHECK(status IN ('Draft','Submitted','Approved','Fulfilled','Cancelled')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  fulfilled_at TEXT,
  cancelled_at TEXT,
  version INTEGER NOT NULL CHECK(typeof(version) = 'integer' AND version > 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(total_cents) = 'integer' AND total_cents >= 0)
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL CHECK(length(trim(product_id)) > 0),
  product_name_snapshot TEXT NOT NULL CHECK(length(trim(product_name_snapshot)) > 0),
  sku_snapshot TEXT,
  quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK(typeof(unit_price_cents) = 'integer' AND unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(typeof(line_total_cents) = 'integer' AND line_total_cents >= 0)
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS preserve_submitted_order_details
BEFORE UPDATE OF branch_id, supplier_id, total_cents ON purchase_orders
WHEN OLD.status != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order details are immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_submitted_line_items
BEFORE UPDATE ON purchase_order_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_order_id) != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order line items are immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_submitted_line_items_delete
BEFORE DELETE ON purchase_order_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_order_id) != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order line items are immutable');
END;
