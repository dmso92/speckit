CREATE TABLE IF NOT EXISTS supplier_portal_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL CHECK(length(trim(supplier_id)) > 0),
  event_type TEXT NOT NULL CHECK(event_type = 'purchase_order_submitted'),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(purchase_order_id, event_type)
);
CREATE TABLE IF NOT EXISTS email_outbox_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK(channel = 'email'),
  recipient TEXT NOT NULL CHECK(recipient GLOB '*@*.*'),
  payload TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('Pending','Sent','Failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(attempt_count) = 'integer' AND attempt_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  last_error TEXT,
  UNIQUE(purchase_order_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_supplier_notifications_scope ON supplier_portal_notifications(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_state ON email_outbox_deliveries(state, created_at);
CREATE TRIGGER IF NOT EXISTS immutable_supplier_notification_payload
BEFORE UPDATE OF purchase_order_id, supplier_id, event_type, payload, created_at ON supplier_portal_notifications
BEGIN
  SELECT RAISE(ABORT, 'supplier notification payload is immutable');
END;
CREATE TRIGGER IF NOT EXISTS immutable_email_outbox_payload
BEFORE UPDATE OF purchase_order_id, channel, recipient, payload, created_at ON email_outbox_deliveries
BEGIN
  SELECT RAISE(ABORT, 'email outbox payload is immutable');
END;
