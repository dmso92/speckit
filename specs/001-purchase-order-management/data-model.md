# Data Model: Purchase Order Management

This model implements the entities and behaviors in [spec.md](spec.md). Branches, suppliers, products, users, and authorization remain owned by host/catalog systems; their IDs are referenced and validated through an integration port. The schema below describes the feature's own records.

## Entities

### PurchaseOrder

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | Stable API identifier. |
| `orderNumber` | unique string | Human-readable identifier; formatting convention is an implementation assumption to establish. |
| `branchId` | non-empty external identifier | Originating branch; immutable after submission. |
| `supplierId` | non-empty external identifier | Supplier receiving order; immutable after submission. |
| `createdBy` | actor identifier | Buyer who created/submitted the order; used to prohibit self-approval. |
| `status` | `Draft \| Submitted \| Approved \| Partially Fulfilled \| Fulfilled \| Cancelled` | Exactly the six statuses specified by the feature. |
| `currency` | `USD` | Fixed for this feature. |
| `createdAt`, `updatedAt` | UTC timestamps | `updatedAt` changes on a successful mutation. |
| `submittedAt` | nullable UTC timestamp | Set once on successful submit. |
| `fulfilledAt` | nullable UTC timestamp | Set on successful fulfillment. |
| `cancelledAt` | nullable UTC timestamp | Set on successful cancellation. |
| `version` | positive integer | Optional optimistic concurrency token; API may expose an ETag/version to reject stale edits. |
| `totalCents` | derived integer | Sum of line totals; do not accept as authoritative client input or store a separately mutable value. |

**Relationships**: One purchase order has one branch reference, one supplier reference, one creating buyer, one or more line items before submission, zero or one approval decision, and zero or more supplier-notification/email delivery records.

### PurchaseOrderLineItem

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | Stable line identifier. |
| `purchaseOrderId` | UUID, required FK | Parent order; delete/update behavior must preserve submitted order history. |
| `productId` | non-empty external identifier | Validated against the catalog integration. |
| `productNameSnapshot` | non-empty string | Captured at draft save so the order/notification remains understandable if catalog labels later change. |
| `skuSnapshot` | nullable string | Optional captured catalog code if the source provides one. |
| `quantity` | positive whole integer (assumption) | Fractional quantity precision is not specified; confirm before implementation. |
| `unitPriceCents` | integer `>= 0` | Expected unit price; zero is allowed, negative is invalid. |
| `lineTotalCents` | derived integer | `quantity * unitPriceCents`; calculate server-side. |
| `receivedQuantity` | non-negative whole integer, initially zero | Cumulative quantity from immutable shipment lines; cannot exceed ordered `quantity`. Remaining quantity is derived as `quantity - receivedQuantity`. |

**Validation**: At least one line is required to submit. Each product reference must exist. Reject non-positive/non-integer quantity and negative/non-integer unit price. Validate multiplication and aggregate total against supported integer range before persistence.

### ApprovalDecision

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | Decision audit record. |
| `purchaseOrderId` | UUID, unique FK | At most one final decision per order. |
| `approverId` | actor identifier | Must resolve to a designated organization-wide approver. |
| `decision` | `Approved \| Rejected` | No third decision state is persisted. |
| `reason` | nullable string | Optional decision explanation; spec does not require it. |
| `decidedAt` | UTC timestamp | Set by server. |

**Validation**: Only a submitted order over 1,000,000 cents can receive a decision. `approverId` cannot equal `createdBy`. A decision is final. Approval changes the PO status to `Approved`; rejection leaves the PO status `Submitted` and blocks fulfillment. Rejected orders can be cancelled.

### SupplierPortalNotification

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | Notification identifier. |
| `purchaseOrderId` | UUID, required FK | Submitted order. |
| `supplierId` | external identifier, required | Recipient scope; must match the order supplier. |
| `eventType` | `purchase_order_submitted` | Initial feature event. |
| `payload` | immutable JSON snapshot | Order number, supplier-facing order details, item names/SKUs, quantities, unit prices, and line/order totals. |
| `createdAt` | UTC timestamp | Created in the same transaction as submission. |
| `readAt` | nullable UTC timestamp | Updated by the authenticated supplier after reading. |

**Uniqueness**: One portal notification per PO submission (unique `purchaseOrderId` + `eventType`). Supplier access is scoped from the authenticated supplier identity, not a caller-supplied arbitrary supplier ID.

### EmailOutboxDelivery

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | Delivery attempt record. |
| `purchaseOrderId` | UUID, required FK | Submitted order. |
| `channel` | `email` | Email is sent with Nodemailer. |
| `recipient` | validated email address | Obtained from supplier/catalog integration; do not trust request-supplied recipient. |
| `payload` | immutable JSON/message snapshot | Contains order identifier and summarized line items. |
| `state` | `Pending \| Sent \| Failed` | `Failed` records a terminal/configuration failure; retry policy for transient errors is implementation configuration. |
| `attemptCount` | non-negative integer | Incremented on each delivery attempt. |
| `createdAt`, `updatedAt` | UTC timestamps | Delivery record lifecycle. |
| `sentAt` | nullable UTC timestamp | Set after Nodemailer transport accepts the message. |
| `lastError` | nullable sanitized string | Never persist credentials or sensitive transport configuration. |

**Uniqueness**: One initial email outbox record per PO submission (unique `purchaseOrderId` + `channel`). The dispatcher sends outside the database transaction. Nodemailer test/development transport captures the message; it does not prove delivery to a real mailbox.

### FulfillmentShipment

| Field | Type / rule | Notes |
|---|---|---|
| `id` | UUID, primary key | One accepted shipment receipt. |
| `purchaseOrderId` | UUID, required FK | Parent order; history remains after cancellation. |
| `recordedBy` | authenticated actor identifier | Supplied by server context, never by the request body. |
| `recordedAt` | UTC timestamp | Assigned by server; chronological history uses time and stable insertion order. |

### FulfillmentShipmentLine

| Field | Type / rule | Notes |
|---|---|---|
| `shipmentId` | UUID, required FK | Parent shipment. |
| `purchaseOrderLineItemId` | UUID, required FK | Must identify a line on the shipment's purchase order. |
| `quantity` | positive whole integer | Quantity received in this shipment; unique once per line per shipment. |

**Immutability and atomicity**: Shipment headers and lines cannot be updated or deleted. A shipment must contain at least one line; the application validates the entire body before writing, and a single database transaction inserts the header/lines, increments cumulative received quantities, and changes status. A transaction abort leaves no shipment, quantity, or status change. Database constraints/triggers prevent invalid quantities, cross-order line references, shipments after cancellation/completion, and cumulative over-receipt.

## Derived Values and Core Rules

- `lineTotalCents = quantity * unitPriceCents`.
- `totalCents = sum(lineTotalCents)` across the order's line items.
- High-value approval required iff `totalCents > 1_000_000`; exactly $10,000.00 does not require approval.
- Submit transaction: verify draft and references; calculate totals; set `Submitted` and `submittedAt`; create portal inbox record and email outbox record. Commit all or none. Dispatch email after commit.
- The API and UI display derived totals from server responses. Client-calculated totals are preview-only.
- An order is `Partially Fulfilled` iff at least one unit has been received and at least one ordered unit remains; it is `Fulfilled` iff every line has reached its ordered quantity. While status is `Partially Fulfilled`, shipment recording remains eligible. Fulfillment history is returned oldest-first and is empty when no shipment exists.
- Cancellation from `Partially Fulfilled` preserves all shipment/received data; the remaining unreceived quantities are cancelled implicitly by terminal order status and are not represented as a separate shipment or mutable quantity. No shipment is permitted after cancellation.
- Use database constraints where applicable (status/decision/channel enumerations, non-negative cents, positive quantity, foreign-key to PO, unique notification/outbox key) and repeat domain validation in application code for actionable errors.

## State Transitions

| Current state | Command | Preconditions | Result |
|---|---|---|---|
| none | create | Authorized buyer; branch/supplier references accepted | `Draft` |
| `Draft` | edit | Authorized owning buyer; line/reference values valid | `Draft` with recalculated totals |
| `Draft` | submit | Supplier, branch, >=1 valid line; catalog checks pass | `Submitted`; create both notification records |
| `Draft` | cancel | Authorized buyer | `Cancelled` |
| `Submitted` | approve | Total > $10,000; designated approver; approver != submitter; no prior decision | `Approved` + `Approved` decision |
| `Submitted` | reject | Same eligibility as approve | `Submitted` + `Rejected` decision |
| `Submitted` | fulfill | Total <= $10,000 and no rejection; authorized fulfiller; positive quantities for known lines | `Partially Fulfilled` or `Fulfilled` based on cumulative receipts |
| `Approved` | fulfill | Approval decision is `Approved`; authorized fulfiller; positive quantities for known lines | `Partially Fulfilled` or `Fulfilled` based on cumulative receipts |
| `Partially Fulfilled` | fulfill | Authorized fulfiller; eligible positive quantities that do not exceed remaining amounts | `Partially Fulfilled` or `Fulfilled` |
| `Submitted` / `Approved` / `Partially Fulfilled` | cancel | Authorized buyer | `Cancelled`; preserve shipment history/received quantities and prohibit further shipments |
| `Fulfilled` / `Cancelled` | any lifecycle mutation | Never allowed | No change; conflict response |

There is intentionally no `Rejected` purchase-order status. A rejected high-value order remains `Submitted`, but its decision record prevents fulfillment. Only `Draft` is editable. Fulfilled and cancelled orders are terminal. Shipment history is retained for the lifetime of the purchase order and has no update/delete operation.
