# Purchase Order Management

Standalone npm workspace implementing purchase-order drafts, supplier submission notifications, and high-value approval. The domain/application package is reusable; Express, SQLite, Nodemailer, and React are adapters around it.

## Runtime and first run

- Node.js `22.12.0` is the selected baseline in `.nvmrc`; the runtime and native SQLite driver compatibility still need to be verified in CI because this workspace was scaffolded without Node/npm available.
- Install dependencies with `npm install`.
- Run `npm run db:migrate` to create/update the file-backed SQLite database. `PO_DB_PATH` may point to another file.
- Run `npm run dev` to start the API on port 3000 and the Vite UI on port 5173.
- Swagger UI is served at `http://localhost:3000/api-docs`; the normative contract is `specs/001-purchase-order-management/contracts/openapi.yaml`.

The core workflow requires host identity, branch/supplier/product catalog, and supplier-contact adapters. No such provider exists in this standalone workspace. Until the host integrates them, the production API intentionally returns 401 for missing authentication and rejects catalog lookups; authorization does not default to allow.

## Development-only fixtures

For an isolated local demonstration only, use `npm run dev:fixtures`. This sets the API and Vite fixture switches, displays a development-only banner, and enables synthetic identities (`dev-buyer`, `dev-approver`, `dev-fulfiller`, `dev-supplier`), catalog IDs (`branch-demo`, `supplier-demo`, `widget-demo`), a `.test` supplier address, and Nodemailer stream capture. Fixture code is gated by `NODE_ENV=development` and `PO_ENABLE_DEV_FIXTURES=true`; the browser also needs `VITE_ENABLE_DEV_FIXTURES=true`. Never set these flags in production. Captured mail does not prove remote delivery.

Production SMTP settings, when approved, are supplied outside source control through `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optional `SMTP_FROM`. The email outbox is written atomically with submission; a post-commit dispatcher processes pending delivery intents and stores sanitized outcomes. The real host identity/catalog/portal adapters remain integration work, not simulated production data.

## Architecture

- `packages/purchase-orders`: framework-independent domain types/rules, catalog and authorization ports, SQLite migrations/repository, draft and notification services.
- `apps/api`: Express REST adapter, fail-closed authenticated actor boundary, contract-driven resource routes, and Swagger UI.
- `apps/web`: accessible responsive React/TypeScript screens with actor and purchase-order state in React Context.
- `specs/001-purchase-order-management`: source specification, data model, notification contract, and OpenAPI contract.

USD is stored as integer cents. SQLite integration tests use temporary file-backed databases rather than mocked persistence. Submission atomically records the Submitted state, supplier-scoped inbox snapshot, and email outbox intent. Email I/O occurs after commit. An order over 1,000,000 cents needs a final decision by a designated approver distinct from its creator; rejection leaves it Submitted and blocks fulfillment.

## Validation commands

```sh
npm run build
npm run typecheck
npm run test:unit
npm run test:contract
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

The browser suite starts the development-only API/UI through `npm run dev:fixtures`. Tests and builds have not been executed in the current environment because Node.js and npm are unavailable.
