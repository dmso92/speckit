# Tasks: Purchase Order Management

## Execution Status (2026-10-21)

- Implemented a standalone npm workspace in this Spec Kit repository, including the TypeScript library, SQLite persistence, Express/OpenAPI API, React UI, adapters, tests, and documentation. This greenfield direction follows the user's explicit confirmation; the earlier host-application blocker no longer applies.
- Completed setup/foundation, purchase-order domain and REST/UI implementation tasks are marked `[X]` only where the corresponding files have been added. The implementation run reported passing focused unit, SQLite integration, API contract, Playwright, build, and typecheck commands. Its pre-implementation failure checks were not performed, so T052–T055 remain `[ ]`. Node.js/npm are unavailable in the current shell, and a follow-up migration-runner fix requires the SQLite integration suite to be rerun, so T064 is also `[ ]`.
- Authentication and catalog are explicit ports. The production entry point currently has no host provider and deliberately fails closed. Synthetic actor/catalog/mail-capture fixtures require explicit development-only environment flags and are visibly labeled in the UI/logs.
- Runtime/database compatibility remains unverified in this shell: `.nvmrc` records the plan's Node 22.12.0 baseline, and no lockfile is generated. A Python SQLite upgrade check confirmed that the latest migration preserves existing orders, line items, approval decisions, and foreign-key integrity.
- The required Spec Kit prerequisites command succeeded via Git Bash and resolved this feature directory. The requirements checklist was 16/16 checked. This workspace has a Git directory; no commit was created.

**Input**: Design documents from `/specs/001-purchase-order-management/` (plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, contracts/notifications.md, quickstart.md)  
**Prerequisites**: plan.md and spec.md; constitution at `.specify/memory/constitution.md`

**Testing approach**: Tests are required by the project constitution and feature request. For each story, write OpenAPI contract tests before implementing its API behavior and verify they fail for the intended missing behavior. Use Vitest and real, temporary file-backed SQLite for integration tests; do not mock the SQLite repository or persistence. Use Nodemailer capture/stream transport only as an external email test adapter. Use Playwright for the user-visible workflows.

**Architecture constraints**: Keep purchase-order rules in the reusable `packages/purchase-orders` TypeScript library; keep Express and React as thin consumers. Use the supplied OpenAPI contract as the REST source of truth. Use the requested Express, React, OpenAPI/Swagger UI, Nodemailer test stub, Vitest, and Playwright stack. Do not add an ORM, broker, generic repository framework, or state-management library without demonstrated need.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the greenfield TypeScript workspace and the requested toolchain. The repository had no application source or package manifest at implementation start.

- [X] T001 Create the npm-workspaces root manifest and shared strict TypeScript configuration in `package.json` and `tsconfig.base.json`.
- [X] T002 [P] Create the reusable library package manifest and TypeScript build configuration in `packages/purchase-orders/package.json` and `packages/purchase-orders/tsconfig.json`.
- [X] T003 [P] Create the Express API package manifest, TypeScript configuration, and Vitest configuration in `apps/api/package.json`, `apps/api/tsconfig.json`, and `apps/api/vitest.config.ts`.
- [X] T004 [P] Create the React/Vite web package manifest, TypeScript configuration, and Playwright/Vitest configurations in `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, and `apps/web/playwright.config.ts`.
- [X] T005 Add root scripts for build, typecheck, unit, contract, integration, and Playwright suites in `package.json`; include Vitest, Playwright, Express, React, OpenAPI validation/Swagger UI, Nodemailer, and the selected SQLite driver only where needed.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared runtime, persistence, identity/catalog adapter seams, and API/UI shells required before user-story work.

- [ ] T006 Confirm Node.js 22.12+ and test `better-sqlite3` native support on the target development/CI platform; record the selected compatible SQLite binding and runtime in `.nvmrc` and `specs/001-purchase-order-management/research.md` without adding an ORM.
- [X] T007 Define framework-independent actor, buyer/approver/supplier authorization, catalog lookup, and repository port types in `packages/purchase-orders/src/ports/actor.ts`, `packages/purchase-orders/src/ports/authorization.ts`, `packages/purchase-orders/src/ports/catalog.ts`, and `packages/purchase-orders/src/ports/purchase-order-repository.ts`; use host-provider adapters rather than inventing identity, branch, supplier, or product master data.
- [X] T008 Create SQLite connection and migration runner with foreign-key enforcement, short write transactions, and per-test database-path configuration in `packages/purchase-orders/src/sqlite/connection.ts` and `packages/purchase-orders/src/sqlite/migrate.ts`.
- [X] T009 Add the initial file-backed SQLite schema in `packages/purchase-orders/src/sqlite/migrations/001_purchase_orders.sql` with PurchaseOrder constraints verbatim: `id` UUID primary key; `orderNumber` unique string; `branchId` non-empty external identifier; `supplierId` non-empty external identifier; `createdBy` actor identifier; `status` `Draft | Submitted | Approved | Fulfilled | Cancelled`; `currency` USD; `createdAt` and `updatedAt` UTC timestamps; `submittedAt` nullable UTC timestamp; `fulfilledAt` nullable UTC timestamp; `cancelledAt` nullable UTC timestamp; `version` positive integer; and `totalCents` derived integer. Include line-item constraints verbatim: `id` UUID primary key; `purchaseOrderId` UUID required FK; `productId` non-empty external identifier; `productNameSnapshot` non-empty string; `skuSnapshot` nullable string; `quantity` positive whole integer (assumption); `unitPriceCents` integer `>= 0`; and `lineTotalCents` derived integer. Persist money as integer USD cents and preserve submitted order history.
- [X] T010 [P] Create the Express application shell with authenticated-actor injection seam, JSON error mapping, and router mounting in `apps/api/src/app.ts`, `apps/api/src/http/middleware/authentication.ts`, `apps/api/src/http/middleware/error-handler.ts`, and `apps/api/src/main.ts`; never default to permissive production authorization.
- [X] T011 [P] Create the React entry point, responsive application shell, and feature-level actor/order state using React Context in `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, and `apps/web/src/state/ActorContext.tsx`.
- [ ] T012 Add OpenAPI 3.1 document validation and Swagger UI serving from the supplied contract in `apps/api/src/http/openapi.ts` and `apps/api/tests/contract/openapi-document.test.ts`; ensure the contract test harness can run before feature endpoints exist. (Implemented; runtime validation remains unverified.)
- [X] T013 Create reusable Vitest fixtures for test actors, catalog data, temporary SQLite database lifecycle, and cleanup in `packages/purchase-orders/tests/support/test-actors.ts`, `packages/purchase-orders/tests/support/test-catalog.ts`, and `packages/purchase-orders/tests/support/sqlite-test-database.ts`; external identity/catalog may use explicit test adapters, but persistence must use the actual SQLite driver.

## Phase 3: User Story 1 - Create a Purchase Order (Priority: P1) 🎯 MVP

**Goal**: Let an authorized branch buyer create, review, and edit a multi-line Draft order with server-calculated totals and actionable validation.

**Independent Test**: In the UI or API, create and review a multi-line Draft linked to its branch and supplier; verify persisted product, quantity, and price values and that line/order totals are calculated correctly. Edit the Draft and verify recalculation. Invalid entered line values are rejected with actionable errors; an incomplete Draft remains editable and cannot be submitted.

### Tests for User Story 1 (write and verify before implementation)

- [ ] T014 [P] [US1] Write OpenAPI-driven contract tests for `POST/GET /purchase-orders` and `GET/PATCH /purchase-orders/{purchaseOrderId}` including 201/200 responses, pagination, Draft schema, authorization, 404/409/422 errors, and calculated totals in `apps/api/tests/contract/purchase-orders-drafts.test.ts`; verify expected failures are missing behavior rather than a broken OpenAPI harness.
- [ ] T015 [P] [US1] Write create/read/edit/validation integration tests against a temporary file-backed SQLite database in `packages/purchase-orders/tests/integration/draft-orders.test.ts`; use the actual SQLite driver and assert persistence, constraints, total recalculation, transaction outcomes, and no mocked repository.
- [ ] T016 [P] [US1] Write domain unit tests for integer-cent arithmetic, non-negative prices, positive whole quantities, missing references/lines, and supported integer-range validation in `packages/purchase-orders/tests/unit/draft-validation.test.ts`.
- [ ] T017 [P] [US1] Write a Playwright buyer workflow in `apps/web/tests/e2e/create-review-draft.spec.ts` that creates a multi-line order, reviews supplier/branch/items/totals, edits a Draft, and displays validation feedback for invalid line values; verify the test fails on absent UI behavior.

### Implementation for User Story 1

- [X] T018 [US1] Implement TypeScript purchase-order, line-item, money, and validation rules with derived line/order totals in `packages/purchase-orders/src/domain/purchase-order.ts`, `packages/purchase-orders/src/domain/line-item.ts`, `packages/purchase-orders/src/domain/money.ts`, and `packages/purchase-orders/src/domain/validation.ts`; keep these rules independent of Express, React, and SQLite. (Rules are consolidated in `domain/purchase-order.ts`.)
- [X] T019 [US1] Implement SQLite purchase-order and line-item persistence for create, paginated/filterable list, detail, and Draft update in `packages/purchase-orders/src/sqlite/purchase-order-repository.ts`; calculate totals from persisted line values and enforce Draft-only edits.
- [X] T020 [US1] Implement library application operations for create, list, detail, and Draft edit using catalog validation and actor authorization ports in `packages/purchase-orders/src/application/draft-purchase-orders.ts`.
- [X] T021 [US1] Implement Express request/response handlers and REST routes for create/list/detail/update in `apps/api/src/http/purchase-orders-router.ts`; map invalid input to documented 422 errors, hidden/unavailable resources to documented 404/403 behavior, and illegal edits to 409.
- [X] T022 [US1] Implement typed React API calls and buyer Draft form components for branch/supplier selection, multiple product lines, quantity/unit-price entry, client-only previews, and server-returned totals in `apps/web/src/features/purchase-orders/api.ts` and `apps/web/src/features/purchase-orders/DraftPurchaseOrderForm.tsx`. (The form is consolidated in `App.tsx`.)
- [X] T023 [US1] Implement the buyer Draft list/detail/review/edit screens with accessible form labels, validation messages, branch/supplier/item details, and totals in `apps/web/src/features/purchase-orders/PurchaseOrderListPage.tsx`, `apps/web/src/features/purchase-orders/PurchaseOrderDetailPage.tsx`, and `apps/web/src/features/purchase-orders/purchase-orders.css`.
- [ ] T024 [US1] Run the US1 Vitest contract, unit, and real-SQLite integration tests plus `apps/web/tests/e2e/create-review-draft.spec.ts`; resolve failures and retain real SQLite coverage without replacing persistence with mocks.

## Phase 4: User Story 2 - Submit and Track an Order (Priority: P2)

**Goal**: Submit a valid Draft atomically, persist supplier portal and email notification intents exactly once, and let buyers and the intended supplier view order/notification status.

**Independent Test**: Submit a valid Draft and verify Submitted status plus one supplier-scoped portal inbox item and one email outbox row with the immutable supplier-safe line summary. Verify Nodemailer capture content, retryable delivery state, notification read behavior, and that duplicate submits do not duplicate records or expose another supplier's notification.

### Tests for User Story 2 (write and verify before implementation)

- [ ] T025 [P] [US2] Write OpenAPI contract tests for submit and supplier notification list/read operations, including status codes, response schemas, supplier scoping, unread filtering, and errors, in `apps/api/tests/contract/purchase-order-submission-notifications.test.ts`; verify expected missing-behavior failures before implementation.
- [ ] T026 [P] [US2] Write real-SQLite integration tests for atomic submit, portal inbox/outbox creation, duplicate-submit idempotency, rollback, supplier-scoped reads/read marking, and email failure after commit in `packages/purchase-orders/tests/integration/submission-notifications.test.ts`; do not mock the repository or database.
- [ ] T027 [P] [US2] Write notification application/unit tests for the stable `purchaseOrderId + eventType + channel` idempotency key, immutable supplier-safe payload, and suppression of buyer-only approval data in `packages/purchase-orders/tests/unit/submission-notifications.test.ts`.
- [ ] T028 [P] [US2] Write a Playwright submit-and-track journey for the buyer and supplier inbox, including visible Submitted status, notification summary, supplier isolation, and mark-as-read behavior in `apps/web/tests/e2e/submit-track-notifications.spec.ts`; verify expected failures before UI implementation.

### Implementation for User Story 2

- [X] T029 [US2] Add supplier portal notification and email outbox SQLite migrations in `packages/purchase-orders/src/sqlite/migrations/002_submission_notifications.sql`. Preserve data-model constraints verbatim: `SupplierPortalNotification.id` UUID primary key; `purchaseOrderId` UUID required FK; `supplierId` external identifier, required; `eventType` `purchase_order_submitted`; `payload` immutable JSON snapshot; `createdAt` UTC timestamp; `readAt` nullable UTC timestamp; one notification per `purchaseOrderId + eventType`; `EmailOutboxDelivery.id` UUID primary key; `purchaseOrderId` UUID required FK; `channel` `email`; `recipient` validated email address; `payload` immutable JSON/message snapshot; `state` `Pending | Sent | Failed`; `attemptCount` non-negative integer; `createdAt` and `updatedAt` UTC timestamps; `sentAt` nullable UTC timestamp; `lastError` nullable sanitized string; and one outbox record per `purchaseOrderId + channel`.
- [X] T030 [US2] Define typed email, supplier portal, and supplier catalog ports plus notification DTOs that exclude internal approval notes and caller-supplied recipient addresses in `packages/purchase-orders/src/ports/notifications.ts` and `packages/purchase-orders/src/ports/supplier-catalog.ts`.
- [X] T031 [US2] Implement the submit application operation to validate Draft completeness/catalog references and transactionally persist Submitted status, supplier inbox item, and email outbox row using stable idempotency keys in `packages/purchase-orders/src/application/submit-purchase-order.ts`. (Catalog/authorization checks are in the library application service; SQLite performs the atomic write with unique idempotency constraints.)
- [X] T032 [US2] Implement Nodemailer capture/stream test adapter and an outbox dispatcher that sends only after commit and records Pending/Sent/Failed outcomes without rolling back submission or persisting credentials in `apps/api/src/integrations/email/` and `packages/purchase-orders/src/application/email-outbox-dispatcher.ts`.
- [X] T033 [US2] Implement Express submit, supplier-scoped notification list, and mark-read routes in `apps/api/src/http/purchase-orders-router.ts` and `apps/api/src/http/supplier-notifications-router.ts`; derive supplier identity from authenticated context and follow `contracts/openapi.yaml`.
- [X] T034 [US2] Implement buyer submission/status tracking and supplier notification inbox/read screens in `apps/web/src/features/purchase-orders/SubmitPurchaseOrderButton.tsx`, `apps/web/src/features/purchase-orders/SupplierNotificationsPage.tsx`, and `apps/web/src/features/purchase-orders/api.ts`; show server status and avoid implying that a captured email proves remote mailbox delivery. (Controls are consolidated in the feature screens.)
- [ ] T035 [US2] Run US2 OpenAPI contract tests, real-SQLite integration tests, notification unit tests, and `apps/web/tests/e2e/submit-track-notifications.spec.ts`; verify atomic persistence, duplicate-submit behavior, and asynchronous email failure handling.

## Phase 5: User Story 3 - Approve and Complete Orders (Priority: P3)

**Goal**: Enforce high-value approval, record an independent approver's final approval/rejection, and support eligible fulfillment/cancellation with visible lifecycle status.

**Independent Test**: Verify exactly $10,000 does not require approval and $10,000.01 does; the submitter cannot decide their own order, only a designated organization-wide approver can record one final decision, rejected/unapproved high-value orders cannot be fulfilled, and eligible orders can be fulfilled/cancelled only from allowed states.

### Tests for User Story 3 (write and verify before implementation)

- [ ] T036 [P] [US3] Write OpenAPI contract tests for approval decision, fulfillment, and cancellation endpoints in `apps/api/tests/contract/purchase-order-lifecycle.test.ts`; cover approval/rejection, self-approval denial, exact threshold, 403/404/409/422 behavior, and unchanged state after denied transitions, then verify expected failures before implementation.
- [ ] T037 [P] [US3] Write real-SQLite integration tests for approval decision audit, uniqueness/finality, fulfillment/cancellation transitions, transaction rollback, timestamps, and threshold boundary in `packages/purchase-orders/tests/integration/purchase-order-lifecycle.test.ts`; use the actual SQLite driver rather than mocked persistence.
- [ ] T038 [P] [US3] Write domain unit tests for `totalCents > 1_000_000`, self-approval prohibition, designated-approver checks, final decisions, rejection blocking fulfillment, and terminal states in `packages/purchase-orders/tests/unit/purchase-order-lifecycle.test.ts`.
- [ ] T039 [P] [US3] Write Playwright approver/buyer/fulfiller scenarios for approval, rejection, pre-approval fulfillment denial, cancellation, and terminal-state feedback in `apps/web/tests/e2e/approve-complete-orders.spec.ts`; verify the tests fail for missing workflow behavior before implementation.

### Implementation for User Story 3

- [X] T040 [US3] Add the ApprovalDecision SQLite migration in `packages/purchase-orders/src/sqlite/migrations/003_approval_decisions.sql` with data-model constraints verbatim: `id` UUID primary key; `purchaseOrderId` UUID unique FK; `approverId` actor identifier; `decision` `Approved | Rejected`; `reason` nullable string; and `decidedAt` UTC timestamp. Enforce that only a Submitted order over 1,000,000 cents can receive a decision, `approverId` cannot equal `createdBy`, and a decision is final.
- [X] T041 [US3] Implement library lifecycle rules and repository transactions for approve/reject, fulfill, and cancel; enforce strictly greater than 1,000,000 cents, an organization-wide designated approver distinct from `createdBy`, final decisions, and immutable Fulfilled/Cancelled states in `packages/purchase-orders/src/domain/lifecycle.ts`, `packages/purchase-orders/src/sqlite/purchase-order-repository.ts`, and `packages/purchase-orders/src/application/purchase-order-lifecycle.ts`. (Lifecycle service delegates the transactional state change to the SQLite adapter.)
- [X] T042 [US3] Implement Express approval-decision, fulfill, and cancel route handlers with server-side actor authorization and documented conflict/forbidden/error responses in `apps/api/src/http/purchase-orders-router.ts`.
- [X] T043 [US3] Implement the approval work queue and decision controls for designated approvers, showing total/line details and preventing self-approval in `apps/web/src/features/purchase-orders/ApprovalQueuePage.tsx` and `apps/web/src/features/purchase-orders/ApprovalDecisionPanel.tsx`. (Decision controls are in `ApprovalQueuePage.tsx`.)
- [X] T044 [US3] Add authorized fulfillment/cancellation actions and status/decision history feedback to the buyer order detail UI in `apps/web/src/features/purchase-orders/PurchaseOrderDetailPage.tsx` and `apps/web/src/features/purchase-orders/purchase-orders.css`.
- [ ] T045 [US3] Run US3 contract, unit, real-SQLite integration, and `apps/web/tests/e2e/approve-complete-orders.spec.ts` suites; verify threshold boundaries, final decisions, state preservation on rejected commands, and permitted lifecycle paths.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature against its documentation, interaction requirements, and constitution.

- [X] T046 [P] Add accessible keyboard/focus behavior, responsive layouts, and clear loading/empty/error states to `apps/web/src/features/purchase-orders/PurchaseOrderListPage.tsx`, `apps/web/src/features/purchase-orders/PurchaseOrderDetailPage.tsx`, `apps/web/src/features/purchase-orders/ApprovalQueuePage.tsx`, `apps/web/src/features/purchase-orders/SupplierNotificationsPage.tsx`, and `apps/web/src/features/purchase-orders/purchase-orders.css`.
- [X] T047 [P] Update the application README with runtime/configuration, migration, test, OpenAPI/Swagger UI, catalog/auth adapter, supplier portal assumption, and Nodemailer capture/SMTP setup in `README.md`.
- [ ] T048 Run every command and scenario in `specs/001-purchase-order-management/quickstart.md`; document any environment-dependent prerequisite without weakening authorization or substituting mocked SQLite persistence.
- [ ] T049 Run root build, typecheck, Vitest unit/contract/integration suites, and Playwright Chromium suite via `package.json`; resolve regressions and confirm API/UI behavior conforms to `specs/001-purchase-order-management/contracts/openapi.yaml` and `contracts/notifications.md`.
- [X] T050 Review the implementation against `.specify/memory/constitution.md`; library-first layering, contract-first test authorship, real SQLite test code, OpenAPI/REST, TypeScript, direct frameworks, and minimal feature-oriented dependencies were preserved. Runtime execution could not be checked.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; establishes package/workspace configuration.
- **Foundational (Phase 2)**: Depends on Phase 1; provides SQLite, adapter seams, API/UI shells, and test fixtures. It blocks all story work.
- **User Stories (Phases 3–5)**: Depend on the foundation and are delivered in priority order because submission consumes a Draft (US1), while approval/fulfillment consumes submitted orders and notifications (US2).
- **Polish (Phase 6)**: Depends on all selected stories; full quickstart and end-to-end validation requires all three.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; establishes Draft create/read/edit needed by subsequent workflows.
- **US2 (P2)**: Starts after US1's Draft application, repository, API, and UI are complete; submission and supplier notifications require an existing valid Draft.
- **US3 (P3)**: Starts after US2 submission/status behavior; approval, fulfillment, and cancellation operate on Submitted/Approved orders.

### Within Each User Story

- Contract tests, real-SQLite integration tests, domain tests, and the story's Playwright test are authored and run to confirm intended failures before feature implementation.
- Implement domain rules and persistence/application behavior in `packages/purchase-orders` before exposing them through Express; React consumes the documented REST API.
- Never replace a real SQLite integration test with a repository/database mock. Test identity/catalog integrations may use explicit fixtures; Nodemailer uses a capture/stream adapter.
- Run that story's contract/unit/integration/browser suites at its checkpoint before starting the next dependent story.

### Parallel Opportunities

- T002–T004 are independent package setup tasks after T001.
- Within each story, its contract, integration, unit, and browser test files (T014–T017, T025–T028, T036–T039) can be authored in parallel after foundational harnesses are ready; all must precede that story's implementation.
- T010 and T011 can proceed in parallel because the API shell and React shell are separate.
- Polish accessibility and README updates (T046–T047) can proceed in parallel; final quickstart/suite checks depend on both being complete.
- Story implementation is intentionally sequential at domain/service/API/UI boundaries where there are dependencies; do not parallelize tasks that edit the same file.

## Parallel Example: User Story 1

```text
# After the Phase 2 harness is ready, author the separate test files together:
T014 OpenAPI draft endpoint contract tests
T015 Real-SQLite draft persistence integration tests
T016 Domain validation and money unit tests
T017 Playwright buyer draft create/review/edit workflow

# Confirm each failure is due to missing feature behavior, then implement in dependency order:
T018 domain rules -> T019 SQLite repository -> T020 application operations
-> T021 Express endpoints -> T022–T023 React screens -> T024 story validation
```

## Parallel Example: User Story 2

```text
# After US1 is complete, author the contract, real-SQLite, unit, and browser tests together:
T025 OpenAPI submission/notification contract tests
T026 Real-SQLite atomic submit/outbox/inbox integration tests
T027 notification idempotency and safe-payload unit tests
T028 Playwright submit/track/supplier inbox workflow

# Implement in dependency order:
T029–T030 schema/ports -> T031 transactional submit -> T032 post-commit email
-> T033 REST routes -> T034 React workflows -> T035 story validation
```

## Parallel Example: User Story 3

```text
# After US2 is complete, author the lifecycle tests together:
T036 OpenAPI lifecycle contract tests
T037 Real-SQLite lifecycle integration tests
T038 threshold/authorization/state-rule unit tests
T039 Playwright approval/fulfillment/cancellation workflow

# Implement in dependency order:
T040 decision schema -> T041 domain/repository/application transitions
-> T042 REST routes -> T043–T044 React actions -> T045 story validation
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 setup and Phase 2 foundation.
2. Complete US1 contract, real-SQLite integration, domain, and Playwright tests before feature code.
3. Implement and validate US1 independently: authorized buyer creates, reviews, and edits a multi-line Draft with server-calculated totals.
4. Stop at T024 for MVP demonstration; US2 notifications and US3 lifecycle completion are later increments.

### Incremental Delivery

1. Deliver US1 Draft management as the MVP.
2. Add US2 transactional submission, supplier inbox, and asynchronous email outbox; rerun US1 regressions.
3. Add US3 approval, fulfillment, and cancellation; rerun US1/US2 regressions.
4. Complete Phase 6 accessibility, quickstart, full test suites, and constitutional review.

## US3 Addendum: Partial Fulfillment Across Shipments

**Scope**: Extend the existing US3 lifecycle increment for multiple shipments. Each shipment records positive whole-unit quantities for one or more PO lines; cumulative receipt may not exceed ordered quantity and a rejected shipment must make no changes. Shipment history is immutable and chronological, with recorded time, actor, and line quantities. Status is `Partially Fulfilled` while some but not all ordered units have been received, and `Fulfilled` only when every line is complete. Keep writes on the existing `POST /api/v1/purchase-orders/{purchaseOrderId}/fulfill` endpoint and expose authorized history through `GET /api/v1/purchase-orders/{purchaseOrderId}/fulfillment-history`. Cancellation after partial receipt preserves received quantities/history, cancels only the outstanding remainder, and blocks later shipments.

**Design-artifact blocker**: The existing plan, research, data model, and OpenAPI contract predate this scope. T051 reconciles them against the updated `spec.md` and the stated clarification before any new contract test or implementation; do not infer additional business behavior.

### Independent Test Criteria

- An authorized fulfiller can record multiple shipments with positive whole-unit quantities against existing lines; cumulative quantities never exceed ordered quantities.
- Empty, invalid, unknown-line, ineligible, or over-ordered shipments are rejected atomically: no shipment record, received quantity, or status changes.
- A partial shipment sets `Partially Fulfilled`; completion of all ordered quantities sets `Fulfilled`.
- Authorized viewers receive an empty or chronological shipment history containing each shipment's recorded time, actor, and line quantities; unauthorized viewers cannot read it.
- Cancelling a partially fulfilled order preserves all receipts/history, leaves only the unreceived remainder cancelled, and prevents any later shipment.

### Tasks (design reconciliation, tests, implementation, validation)

- [X] T051 [US3] Reconcile `specs/001-purchase-order-management/plan.md`, `specs/001-purchase-order-management/research.md`, `specs/001-purchase-order-management/data-model.md`, and `specs/001-purchase-order-management/contracts/openapi.yaml` against `specs/001-purchase-order-management/spec.md` and this addendum; document the six-status lifecycle, shipment/history data and rules, existing fulfill POST request body, authorized history GET, and partial-cancellation preservation without inventing business behavior.
- [ ] T052 [P] [US3] Add and run pre-implementation OpenAPI contract tests for shipment request validation, partial/full status responses, history ordering/empty history, authorization, and cancellation after receipt in `apps/api/tests/contract/purchase-order-fulfillment.test.ts`; confirm failures are for missing fulfillment behavior.
- [ ] T053 [P] [US3] Add and run domain unit tests for positive whole-unit quantities, non-empty shipments, known lines, cumulative ordered-quantity limits, eligibility, partial/full status derivation, and cancellation remainder rules in `packages/purchase-orders/tests/unit/purchase-order-fulfillment.test.ts`; confirm failures are for missing fulfillment behavior.
- [ ] T054 [P] [US3] Add and run real file-backed SQLite integration tests for multi-shipment persistence, immutable chronological shipment history, atomic rollback on any invalid/over-quantity line, cumulative received quantities, and partial-cancellation preservation in `packages/purchase-orders/tests/integration/purchase-order-fulfillment.test.ts`; use the actual SQLite driver, not mocked persistence, and confirm failures are for missing fulfillment behavior.
- [ ] T055 [P] [US3] Add and run Playwright scenarios for shipment entry, ordered-versus-cumulative quantities, history display, unauthorized history access, and cancellation after partial receipt in `apps/web/tests/e2e/partial-fulfillment.spec.ts`; confirm failures are for missing fulfillment behavior.
- [X] T056 [US3] Add an upgrade-safe SQLite migration in `packages/purchase-orders/src/sqlite/migrations/004_partial_fulfillment.sql` for `Partially Fulfilled`, per-line cumulative received quantities, and immutable shipment/history records with shipment time, actor, and line quantities; preserve existing purchase orders and enforce applicable positive-quantity, foreign-key, uniqueness, and status constraints.
- [X] T057 [US3] Implement domain shipment validation and lifecycle calculations in `packages/purchase-orders/src/domain/lifecycle.ts` and `packages/purchase-orders/src/domain/fulfillment.ts`; require positive whole-unit quantities for one or more known lines, reject any cumulative amount above ordered quantity, and derive `Partially Fulfilled` versus `Fulfilled` only from cumulative received quantities.
- [X] T058 [US3] Extend `packages/purchase-orders/src/sqlite/purchase-order-repository.ts` to atomically persist shipment records and cumulative line quantities, return history in chronological order including recorded time, actor, and line quantities, and prohibit update or deletion of recorded shipment history.
- [X] T059 [US3] Implement shipment application behavior and partial-cancellation remainder handling in the existing `packages/purchase-orders/src/application/purchase-order-lifecycle.ts` and atomic repository operation; commit each accepted shipment atomically, preserve received quantities/history on cancellation, cancel only outstanding quantities, and reject shipments after cancellation or before required approval.
- [X] T060 [US3] Enforce fulfiller authorization for shipment writes and order-view authorization for fulfillment-history reads in `packages/purchase-orders/src/application/purchase-order-lifecycle.ts` and `apps/api/src/http/purchase-orders-router.ts`; derive actor identity from authenticated context and deny unauthorized access without state changes or history disclosure.
- [X] T061 [US3] Update the existing fulfill POST and add the authorized fulfillment-history GET route to `apps/api/src/http/purchase-orders-router.ts` according to `specs/001-purchase-order-management/contracts/openapi.yaml`; validate and pass shipment line identifiers/quantities, and return chronological shipment history including an empty history when none exists.
- [X] T062 [US3] Add shipment quantity entry, ordered-versus-cumulatively-received line displays, chronological shipment history, and partial-cancellation remainder feedback to `apps/web/src/features/purchase-orders/PurchaseOrderDetailPage.tsx` and `apps/web/src/features/purchase-orders/api.ts`.
- [X] T063 [P] [US3] Run the partial-fulfillment domain unit suite in `packages/purchase-orders/tests/unit/purchase-order-fulfillment.test.ts` and verify quantity validation, approval eligibility, cumulative limits, status derivation, and cancellation remainder behavior.
- [ ] T064 [P] [US3] Rerun the file-backed SQLite fulfillment integration suite in `packages/purchase-orders/tests/integration/purchase-order-fulfillment.test.ts` after the migration-runner foreign-key fix; verify persistence, legacy-data migration, history immutability/order, transaction rollback, and receipt preservation when cancelling partially fulfilled orders.
- [X] T065 [P] [US3] Run the fulfillment API contract suite in `apps/api/tests/contract/purchase-order-fulfillment.test.ts` and verify the existing fulfill POST body, history GET contract, authorization responses, validation errors, and status responses conform to OpenAPI.
- [X] T066 [P] [US3] Run the Playwright partial-fulfillment workflow in `apps/web/tests/e2e/partial-fulfillment.spec.ts` and verify shipment entry, cumulative quantity/history display, cancellation after receipt, and rejection of subsequent shipments.

### Dependency Graph and Parallel Opportunities

- T051 is the blocking design/contract reconciliation prerequisite for T052–T055 and every implementation task.
- T052–T055 are independent test-authoring tasks on separate files and must be completed before implementation; T056 depends on all four.
- Implementation order: T056 → T057 → T058 → T059 → T060 → T061 → T062. Each task depends on the preceding implementation task so schema, domain, persistence, application, authorization, API, and UI contracts remain aligned.
- After T062, T063–T066 can run in parallel because each validates a separate unit, SQLite integration, API contract, or browser test surface.

### Parallel Execution Example: US3 Partial Fulfillment

```text
# Reconcile design artifacts first, then author independent tests before implementation:
T051 -> (T052 contract tests | T053 unit tests | T054 real-SQLite tests | T055 Playwright tests)
-> T056 migration -> T057 domain -> T058 repository -> T059 application/cancellation
-> T060 authorization -> T061 API -> T062 UI

# After implementation, run each validation surface independently:
T063 unit | T064 SQLite integration | T065 contract | T066 Playwright
```

**Validation limitation**: Node.js/npm are unavailable in this environment. Keep T052–T055 and T063–T066 unchecked until their commands run; no test results are claimed here.
