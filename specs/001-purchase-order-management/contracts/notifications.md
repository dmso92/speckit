# Supplier Notification Contract

This contract defines the application boundary used by the purchase-order service. It does not assume that an email server or supplier portal already exists.

## Event

| Property | Contract |
|---|---|
| Event | `purchase_order_submitted` |
| Trigger | A Draft PO has passed server-side validation and its submission transaction commits. |
| Recipient | Supplier associated with the submitted order; email address comes from the catalog/supplier integration, never directly from the submitting request. |
| Idempotency | One portal notification and one email outbox row per PO submission. Use a stable key derived from `purchaseOrderId + eventType + channel`. Duplicate submit requests must not duplicate notifications. |
| Payload | PO identifier and order number, branch/supplier references, USD total in cents, and a snapshot of each product name/SKU (if available), quantity, expected unit price, and line total. |
| Confidentiality | Only the intended supplier may read its portal notification. Do not include internal approval notes or buyer-only data in the supplier payload. |

## Application Ports

The implementation should expose narrow typed ports corresponding to these operations:

- `EmailNotifier.enqueue(message)`: create the durable email delivery intent in the same database transaction as submission. A dispatcher later asks the Nodemailer adapter to send the stored message and records `Pending`, `Sent`, or `Failed` outcome.
- `SupplierPortalNotifier.createInboxItem(notification)`: create a supplier-scoped inbox item in that same transaction. The proposed initial adapter stores it in the feature's SQLite table; `GET /api/v1/supplier-notifications` exposes it to an authenticated supplier, and the read operation marks it read.
- `SupplierCatalog.getSupplierContact(supplierId)`: resolve the recipient address and verify supplier reference; details and ownership of the host catalog integration remain to be confirmed.

The two notification records and PO transition are committed atomically. SMTP/network I/O must not occur while holding a SQLite write transaction. Email delivery is asynchronous and retryable; the API's successful submit response confirms persisted submission and notification intent, not proof that a remote mailbox accepted the message.

## Nodemailer Adapter

- Production configuration: use an approved Nodemailer transport (normally authenticated SMTP) supplied through environment/secret configuration.
- Development/test configuration: use a capture/stream transport and assert the generated recipient, subject, identifier, and item summary without connecting to a real mail server.
- Never place transport credentials in source, logs, OpenAPI examples, or persisted error detail.
- A transport failure leaves the PO submitted and the outbox record retryable/observable; it does not roll back a PO already committed. Retry limits/backoff and operational alerting are deployment configuration decisions not specified by the feature.

## Portal Integration Assumption

No portal code or integration endpoint was found. The initial design treats a persisted SQLite notification row plus the supplier-scoped REST endpoints in [openapi.yaml](openapi.yaml) as the portal notification surface. Confirm with the host application owner whether the real portal should consume this API or whether an existing portal-specific adapter/store must replace it before implementation. A no-op portal adapter would not satisfy the feature.
