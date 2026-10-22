# Quickstart: Purchase Order Management Validation

This guide targets the planned implementation. The current workspace contains no app source, `package.json`, lockfile, or runtime scripts, so these commands become executable when the app is scaffolded; they cannot run against this Spec Kit-only workspace yet. Script names and local ports are proposed defaults to standardize during implementation.

## Prerequisites

- Node.js 22.12+ and npm (confirm the host application's supported runtime before setup).
- SQLite support for the selected driver; integration tests use a temporary file-backed SQLite database.
- Chromium installed for Playwright: `npx playwright install chromium`.
- Development/test identities for a buyer, independent designated approver, fulfiller, and supplier.
- Test catalog entries for one branch, one supplier with a test email, and products. These come from the host catalog integration/fixtures; this feature does not own catalog records.
- Nodemailer test transport configured to capture messages. Do not use production SMTP credentials in local or automated tests.

## Start and Inspect

```sh
npm ci
npm run db:migrate
npm run dev
```

Proposed local URLs:

- React UI: `http://localhost:5173`
- Express API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI source: `specs/001-purchase-order-management/contracts/openapi.yaml`

The host application's authentication and catalog integration may require a local development profile. Never disable server-side authorization to make a validation scenario pass.

## Contract-First Check

Before implementing API routes, add contract tests from [openapi.yaml](contracts/openapi.yaml), then run:

```sh
npm run test:contract
```

**Expected before implementation**: the newly written tests fail for the intended reason (missing operations/behavior), not because the OpenAPI document cannot be read or the test harness is broken. After implementation, the same command passes and validates request/response schemas and status/error behavior.

## API Scenarios

Use test tokens issued by the configured development identity provider and catalog IDs seeded for the test environment. Set `BUYER_TOKEN`, `APPROVER_TOKEN`, and `SUPPLIER_TOKEN` in the shell from your local test identity provider; do not put token values in this guide or source control.

```sh
API=http://localhost:3000/api/v1
curl -i -X POST "$API/purchase-orders" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "test-branch-id",
    "supplierId": "test-supplier-id",
    "items": [
      {"productId":"test-product-a","quantity":2,"unitPriceCents":1250},
      {"productId":"test-product-b","quantity":1,"unitPriceCents":4000}
    ]
  }'
```

**Expected**: `201 Created`, `status: Draft`, both lines present, and `totalCents: 6500`. Capture the response PO `id` as `PO_ID`.

```sh
curl -i -X POST "$API/purchase-orders/${PO_ID}/submit" \
  -H "Authorization: Bearer $BUYER_TOKEN"
```

**Expected**: `200 OK`, `status: Submitted`, one supplier portal inbox item, and one email outbox record. The captured Nodemailer message includes the PO identifier and item summary. A supplier-scoped `GET /api/v1/supplier-notifications` returns the portal item; a different supplier identity must not see it.

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
