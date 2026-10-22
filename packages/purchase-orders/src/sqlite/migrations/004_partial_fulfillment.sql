-- migration: foreign_keys=off
CREATE TABLE purchase_orders_with_partial_fulfillment (
  id TEXT PRIMARY KEY NOT NULL,
  order_number TEXT NOT NULL UNIQUE CHECK(length(trim(order_number)) > 0),
  branch_id TEXT NOT NULL CHECK(length(trim(branch_id)) > 0),
  supplier_id TEXT NOT NULL CHECK(length(trim(supplier_id)) > 0),
  created_by TEXT NOT NULL CHECK(length(trim(created_by)) > 0),
  status TEXT NOT NULL CHECK(status IN ('Draft','Submitted','Approved','Partially Fulfilled','Fulfilled','Cancelled')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  fulfilled_at TEXT,
  cancelled_at TEXT,
  version INTEGER NOT NULL CHECK(typeof(version) = 'integer' AND version > 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(total_cents) = 'integer' AND total_cents >= 0)
);

INSERT INTO purchase_orders_with_partial_fulfillment
  (id, order_number, branch_id, supplier_id, created_by, status, currency, created_at, updated_at,
   submitted_at, fulfilled_at, cancelled_at, version, total_cents)
SELECT id, order_number, branch_id, supplier_id, created_by, status, currency, created_at, updated_at,
       submitted_at, fulfilled_at, cancelled_at, version, total_cents
FROM purchase_orders;

DROP TRIGGER IF EXISTS preserve_submitted_line_items;
DROP TRIGGER IF EXISTS preserve_submitted_line_items_delete;
DROP TRIGGER IF EXISTS approval_decision_eligibility;
DROP TABLE purchase_orders;
ALTER TABLE purchase_orders_with_partial_fulfillment RENAME TO purchase_orders;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS preserve_submitted_order_details
BEFORE UPDATE OF branch_id, supplier_id, total_cents ON purchase_orders
WHEN OLD.status != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order details are immutable');
END;

CREATE TRIGGER approval_decision_eligibility
BEFORE INSERT ON approval_decisions
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM purchase_orders WHERE id = NEW.purchase_order_id) != 'Submitted'
      THEN RAISE(ABORT, 'approval requires a submitted purchase order')
    WHEN (SELECT total_cents FROM purchase_orders WHERE id = NEW.purchase_order_id) <= 1000000
      THEN RAISE(ABORT, 'approval requires total over 1000000 cents')
    WHEN (SELECT created_by FROM purchase_orders WHERE id = NEW.purchase_order_id) = NEW.approver_id
      THEN RAISE(ABORT, 'submitter cannot approve their own purchase order')
  END;
END;

ALTER TABLE purchase_order_items
  ADD COLUMN received_quantity INTEGER NOT NULL DEFAULT 0
  CHECK(typeof(received_quantity) = 'integer' AND received_quantity >= 0 AND received_quantity <= quantity);
CREATE TRIGGER preserve_submitted_line_items
BEFORE UPDATE OF product_id, product_name_snapshot, sku_snapshot, quantity, unit_price_cents, line_total_cents ON purchase_order_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_order_id) != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order line items are immutable');
END;
CREATE TRIGGER preserve_submitted_line_items_delete
BEFORE DELETE ON purchase_order_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_order_id) != 'Draft'
BEGIN
  SELECT RAISE(ABORT, 'submitted order line items are immutable');
END;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_order_items_order_id ON purchase_order_items(purchase_order_id, id);

CREATE TABLE fulfillment_shipments (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  recorded_by TEXT NOT NULL CHECK(length(trim(recorded_by)) > 0),
  recorded_at TEXT NOT NULL
);
CREATE INDEX idx_fulfillment_shipments_order_time
  ON fulfillment_shipments(purchase_order_id, recorded_at, id);

CREATE TABLE fulfillment_shipment_lines (
  shipment_id TEXT NOT NULL REFERENCES fulfillment_shipments(id) ON DELETE RESTRICT,
  purchase_order_line_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity > 0),
  PRIMARY KEY(shipment_id, purchase_order_line_item_id)
);

CREATE TRIGGER validate_fulfillment_shipment_order
BEFORE INSERT ON fulfillment_shipments
WHEN (SELECT status FROM purchase_orders WHERE id = NEW.purchase_order_id)
     NOT IN ('Submitted', 'Approved', 'Partially Fulfilled')
BEGIN
  SELECT RAISE(ABORT, 'purchase order is not eligible for shipment receipt');
END;

CREATE TRIGGER validate_fulfillment_shipment_line
BEFORE INSERT ON fulfillment_shipment_lines
BEGIN
  SELECT CASE WHEN
    (SELECT purchase_order_id FROM purchase_order_items WHERE id = NEW.purchase_order_line_item_id)
      != (SELECT purchase_order_id FROM fulfillment_shipments WHERE id = NEW.shipment_id)
    THEN RAISE(ABORT, 'shipment line belongs to another purchase order') END;
  SELECT CASE WHEN
    (SELECT received_quantity + NEW.quantity > quantity
       FROM purchase_order_items WHERE id = NEW.purchase_order_line_item_id)
    THEN RAISE(ABORT, 'shipment quantity exceeds ordered quantity') END;
END;

CREATE TRIGGER immutable_fulfillment_shipments_update
BEFORE UPDATE ON fulfillment_shipments
BEGIN
  SELECT RAISE(ABORT, 'fulfillment history is immutable');
END;
CREATE TRIGGER immutable_fulfillment_shipments_delete
BEFORE DELETE ON fulfillment_shipments
BEGIN
  SELECT RAISE(ABORT, 'fulfillment history is immutable');
END;
CREATE TRIGGER immutable_fulfillment_shipment_lines_update
BEFORE UPDATE ON fulfillment_shipment_lines
BEGIN
  SELECT RAISE(ABORT, 'fulfillment history is immutable');
END;
CREATE TRIGGER immutable_fulfillment_shipment_lines_delete
BEFORE DELETE ON fulfillment_shipment_lines
BEGIN
  SELECT RAISE(ABORT, 'fulfillment history is immutable');
END;
