# Quickstart: Purchase Order Management Validation

This guide targets the standalone workspace implementation. The host identity, catalog, supplier portal, and production SMTP integrations are still absent and must be provided before production use. Node/npm are unavailable in the present environment, so commands below have not been executed here.

## Prerequisites

- Node.js 22.12.0 (selected in `.nvmrc`) and npm. Verify this against deployment policy before adopting it in a host environment.
- Native `better-sqlite3` support for the selected Node/platform combination; this could not be verified in the current environment.
- Chromium installed for Playwright: `npx playwright install chromium`.
- Development/test identities for a buyer, independent designated approver, fulfiller, and supplier.
- Test catalog entries for one branch, one supplier with a test email, and products. These come from the host catalog integration/fixtures; this feature does not own catalog records.
- Nodemailer test transport configured to capture messages. Do not use production SMTP credentials in local or automated tests.

## Start and Inspect

```sh
npm install
npm run db:migrate
npm run dev
```

Proposed local URLs:

- React UI: `http://localhost:5173`
- Express API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI source: `specs/001-purchase-order-management/contracts/openapi.yaml`

For a visible local fixture demonstration, run `npm run dev:fixtures`; it enables synthetic development actors/catalog and Nodemailer capture. It must not run in production. Without host adapters, normal startup deliberately fails closed for identity and catalog access. Never disable server-side authorization to make a validation scenario pass.

## Contract-First Check

The contract test files were authored from [openapi.yaml](contracts/openapi.yaml) before route implementation. Run:

```sh
npm run test:contract
```

The contract-first test files were authored before production implementation. Run the suite to validate the OpenAPI document and API behavior; this environment could not execute it, so passing status and the intended pre-implementation failure reason remain unverified.

## API Scenarios

Use test tokens from the configured host identity provider and seeded catalog identifiers. With `npm run dev:fixtures`, use the synthetic bearer fixture identities described in the README; do not use production tokens in local testing.

```sh
API=http://localhost:3000/api/v1
curl -i -X POST "$API/purchase-orders" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-demo",
    "supplierId": "supplier-demo",
    "items": [
      {"productId":"widget-demo","quantity":2,"unitPriceCents":1250},
      {"productId":"widget-alt","quantity":1,"unitPriceCents":4000}
    ]
  }'
```

**Expected**: `201 Created`, `status: Draft`, both lines present, and `totalCents: 6500`. Capture the response PO `id` as `PO_ID`.

```sh
curl -i -X POST "$API/purchase-orders/${PO_ID}/submit" \
  -H "Authorization: Bearer $BUYER_TOKEN"
```

**Expected**: `200 OK`, `status: Submitted`, one supplier portal inbox item, and one email outbox record. The Nodemailer capture occurs asynchronously after the database commit. A supplier-scoped `GET /api/v1/supplier-notifications` returns the portal item; a different supplier identity must not see it.

To validate high-value approval, create a separate PO whose line-item total is `$10,000.01` (`totalCents: 1000001`), then submit it:

1. Attempt fulfillment before approval; expect `409 Conflict`, no state change, and no fulfillment timestamp.
2. Attempt approval using the submitter's token; expect `403 Forbidden` and no decision.
3. Record `{"decision":"Approved"}` using a different designated approver; expect `status: Approved`.
4. Fulfill as an authorized fulfiller; expect `status: Fulfilled`.
5. For another high-value PO, record `{"decision":"Rejected"}`; expect a recorded rejection with status still `Submitted`, and fulfillment remains `409 Conflict`.

Also verify that exactly `$10,000.00` (1,000,000 cents) does not require a decision and may be fulfilled after submission. Verify cancellation succeeds only from Draft, Submitted, or Approved and that fulfilled/cancelled orders cannot be changed or cancelled again.

## Database and Test Suites

Use a unique temporary database file per integration-test run. On PowerShell:

```powershell
$env:PO_DB_PATH = Join-Path $env:TEMP "purchase-order-integration-test.db"
npm run test:integration
Remove-Item $env:PO_DB_PATH -ErrorAction SilentlyContinue
```

Run validation suites:

```sh
npm run test:unit
npm run test:contract
npm run test:integration
npx playwright test --project=chromium
```

**Expected**:

- Unit tests cover price arithmetic, threshold boundary, validation, authorization, and allowed/denied transitions.
- Integration tests use actual SQLite and prove transaction rollback, persistence, unique notification records, and lifecycle rules across repositories/services. They do not mock SQLite.
- Contract tests conform to OpenAPI schemas and documented errors.
- Playwright creates/reviews a multi-line draft, submits it, observes status changes, and verifies the supplier-notification surface and approval/fulfillment flows.

See [data-model.md](data-model.md) for entity constraints and lifecycle transitions, and [contracts/notifications.md](contracts/notifications.md) for notification delivery and test-stub behavior.
