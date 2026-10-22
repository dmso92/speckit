CREATE TABLE IF NOT EXISTS approval_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_order_id TEXT NOT NULL UNIQUE REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  approver_id TEXT NOT NULL CHECK(length(trim(approver_id)) > 0),
  decision TEXT NOT NULL CHECK(decision IN ('Approved','Rejected')),
  reason TEXT,
  decided_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS approval_decision_eligibility
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
CREATE TRIGGER IF NOT EXISTS approval_decision_final_update
BEFORE UPDATE ON approval_decisions
BEGIN
  SELECT RAISE(ABORT, 'approval decision is final');
END;
CREATE TRIGGER IF NOT EXISTS approval_decision_final_delete
BEFORE DELETE ON approval_decisions
BEGIN
  SELECT RAISE(ABORT, 'approval decision is final');
END;
