# Implementation Plan: Purchase Order Management

**Branch**: `001-purchase-order-management` (planned name; workspace is not a Git repository)  
**Date**: 2026-10-21  
**Spec**: [spec.md](spec.md)

**Input**: `specs/001-purchase-order-management/spec.md` and the user-selected architecture in the planning request.

## Summary

Deliver purchase-order drafting, submission, status tracking, high-value approval, fulfillment/cancellation, and supplier notifications through a TypeScript REST API and responsive React UI. Keep purchase-order rules in a reusable library, use a narrow SQLite repository adapter and service for workflow/notification coordination, and make the OpenAPI document the API source of truth. Submission will atomically persist the status change, supplier-portal inbox item, and email outbox intent; email delivery occurs after commit.

The workspace contains no application source, dependency manifests, or established UI/API patterns. Therefore the structure below is a proposed greenfield layout, not a claim about existing conventions. See [research.md](research.md) for decisions and explicit assumptions.

## Technical Context

**Language/Version**: TypeScript; assume Node.js 22.12+ for the API/tooling, subject to confirmation when the project runtime is established.  
**Primary Dependencies**: Express.js REST API; React with TypeScript and Vite; SQLite binding (proposed `better-sqlite3`, to confirm on target CI/Windows); Nodemailer; OpenAPI 3.x with Swagger UI; Vitest; Playwright.  
**Storage**: SQLite; store money as integer USD cents. Use a file-backed database for integration tests.  
**Testing**: OpenAPI-driven contract tests before implementation; Vitest unit and real-SQLite integration tests; Playwright end-to-end tests.  
**Target Platform**: Node.js API and modern desktop/mobile browsers.  
**Project Type**: Web application with API, frontend, and reusable purchase-order package.  
**Performance Goals**: No numeric latency/throughput target is specified. Keep common list/detail/edit/transition operations interactive; establish measurable service objectives only when deployment context and expected volume are known.  
**Constraints**: USD only; approval iff total is strictly greater than 1,000,000 cents; total excludes tax, freight, discounts, and conversion. SQLite permits a single concurrent writer, so write transactions must be short. Authentication, branch/supplier/product catalogs, and the actual supplier portal are not present in this workspace and require integration decisions.  
**Scale/Scope**: Three user journeys (draft, submit/track, approve/complete), five PO lifecycle statuses, one final approval decision for a high-value order, and two supplier-notification channels. No user/order-volume target is specified.

## Constitution Check

*Gate before Phase 0: PASS, with the user-selected architecture reconciled as follows.*

| Principle | Plan alignment |
|---|---|
| I. Library-First Reusability | Put purchase-order domain/application behavior in `packages/purchase-orders`; keep Express and React as thin consumers. |
| II. Test-Driven Development | Add OpenAPI contract tests first and demonstrate intended failures before production implementation. |
| III. Real-Database Integration Testing | Exercise the actual SQLite driver against a temporary file-backed SQLite database; do not mock persistence. |
| IV. Simplicity and Direct Framework Use | Use Express and React directly. Keep only the requested repository/service boundaries; avoid a generic ORM or extra abstraction framework. |
| V. REST and OpenAPI | Define the REST surface in `contracts/openapi.yaml`; contract tests validate the implementation against it. |
| VI. TypeScript Type Safety | Use TypeScript in the API, shared package, and frontend. |
| VII. Minimal Dependencies | Use the selected stack, evaluate the SQLite binding and tooling at scaffold time, and avoid adding a job queue, ORM, or state-management framework without demonstrated need. |

**Post-design re-check: PASS with explicit integration assumptions.** The design preserves all seven principles. A repository boundary is deliberate, not a general-purpose abstraction: it isolates the selected SQLite persistence and supports real-database tests while the reusable workflow library remains framework-independent. No constitutional waiver is proposed. The lack of an existing catalog, authentication provider, supplier portal, and design system is not treated as evidence that these integrations already exist.

## Project Structure

### Documentation (this feature)

```text
specs/001-purchase-order-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── openapi.yaml
    └── notifications.md
```

### Proposed Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── http/                 # Express routers, request/response mapping
│   │   ├── integrations/         # Auth/catalog/notification adapters
│   │   └── main.ts
│   └── tests/
│       ├── contract/
│       └── integration/
└── web/
    ├── src/
    │   ├── components/
    │   ├── features/purchase-orders/
    │   └── state/                # React Context
    └── tests/e2e/
packages/
└── purchase-orders/
    ├── src/
    │   ├── domain/               # PO rules and value types
    │   ├── application/          # Draft, submit, approve, fulfill, cancel
    │   ├── ports/                # Repository/catalog/notifier interfaces
    │   └── sqlite/               # Concrete repository and migrations
    └── tests/
        ├── unit/
        └── integration/
specs/001-purchase-order-management/contracts/
```

**Structure Decision**: A small workspace layout separates the reusable TypeScript purchase-order capability from transport/UI adapters, matching library-first and the requested React/API architecture. Do not introduce a workspace/build framework beyond package-manager workspaces unless implementation demonstrates a need. No existing application tree was found to preserve. Existing design-system reuse is unavailable; the responsive UI should use a minimal, accessible component/style set until the host design system is identified.

## Complexity Tracking

| Intentional complexity | Why needed | Simpler alternative and why not selected |
|---|---|---|
| One reusable domain/application package plus a narrow SQLite repository and service boundary | Explicit user architecture, reusable-library principle, and isolation of workflow decisions from Express/SQLite details | Direct SQL in route handlers would couple transport, persistence, and approval rules and make reuse and workflow tests harder. Keep this boundary feature-sized; do not add a generic repository framework. |
| Durable notification intents alongside submission | Both channels are required, and persisting the intents in the same SQLite transaction avoids a committed submission with no record of required notifications | Synchronous best-effort sends after commit can lose a notification on process failure. Use a small outbox/dispatcher, not a new broker or queue service. |

## Assumptions and Items to Confirm

- The current workspace is a Spec Kit-only workspace, not the host application. Node version, package manager, Express major, SQLite driver, auth middleware, catalog source, deployment conventions, and design system must be confirmed before implementation; proposed defaults are in [research.md](research.md).
- The spec's FR-006/edge cases say incomplete orders cannot be submitted, while User Story 1 acceptance scenario 4 can be read as preventing save as well as submit. Assumption: permit an incomplete Draft so it can be edited, reject malformed entered values on save, and require a complete valid order on submit. Confirm this interpretation without changing the spec silently.
- Assume quantities are positive whole units for the first release; expected unit prices are non-negative integer cents. Confirm whether fractional quantities are needed.
- There is no supplier portal/catalog/auth implementation in the workspace. The proposed supplier notification is a persisted, supplier-scoped inbox record exposed through the API; confirm that this is compatible with the actual portal integration. Branch/supplier/product IDs are references validated through a catalog port, not newly invented master-data ownership.
- Use the existing identity/access-control provider when identified. The API requires an authenticated actor with buyer/approver/supplier scope but does not define a new identity system.
- The Nodemailer development/test adapter is a stub (capture/stream transport); actual email delivery requires configured production SMTP or another approved Nodemailer transport.
- No numeric load, latency, retention, or availability objective is specified; do not assert one.

**Not created by this Phase 0/1 plan**: implementation code, `tasks.md`, or changes to `spec.md` / constitution.
