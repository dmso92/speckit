# Research: Purchase Order Management

**Context**: Greenfield design from the feature specification and the user-selected stack. Repository inspection found no application source, package manifests, existing API/UI patterns, catalog/auth provider, or supplier portal. Decisions below are planning defaults, not claims about existing infrastructure.

## Decisions

### API and application boundaries

- **Decision**: Use Express.js as a thin REST adapter over a framework-independent TypeScript purchase-order package. Keep state transitions and approval rules in the application/domain layer; keep SQLite access in a focused repository implementation.
- **Rationale**: Aligns with the requested service/repository design and the constitution's library-first rule. Calling Express directly and limiting boundaries to this feature also follows the simplicity principle.
- **Alternatives considered**: Put SQL and business rules in Express route handlers (less modular, contradicts the requested reusable/library-first architecture); add a generic service/repository framework or ORM (unjustified extra abstraction/dependency).

### SQLite and persistence

- **Decision**: Use SQLite as the application database and real file-backed SQLite in integration tests. Represent USD amounts as integer cents; calculate line and order totals from persisted quantities and prices, never from client-provided totals. Make PO state changes, approval records, and notification-intent writes transactional.
- **Rationale**: Integer cents avoid binary floating-point money errors. SQLite transactions provide atomic commit/rollback; its single-writer model favors short write transactions. An outbox preserves delivery intent if a process stops after commit.
- **Alternatives considered**: Floating-point decimal amounts (rounding risk); mocked repository tests (do not validate real SQLite behavior and violate the constitution); external queue/broker (adds operational and dependency complexity without a stated scale need).
- **Driver assumption**: `better-sqlite3` is a proposed single-driver choice for direct SQLite use and concise transactions. It is not established in this repository; confirm native module support in the actual Node/Windows/CI deployment before adoption. If native bindings are unacceptable, select a supported SQLite driver before implementation rather than quietly changing the persistence contract.
- **Transaction behavior**: Insert the submission/status change, supplier-portal inbox item, and email outbox row in one database transaction. The local portal inbox item is immediately queryable after commit; the email outbox is sent through a small dispatcher and delivery outcome recorded. Do not hold a SQLite write lock while performing network I/O.

### Purchase-order workflow and validation

- **Decision**: Preserve the five specified PO statuses. Keep a high-value rejection as an `ApprovalDecision` while the PO remains `Submitted`; eligibility to fulfill is computed from total and decision, not status alone. Approval/rejection is final and single-record per order; a rejected order can be cancelled but not fulfilled or re-submitted.
- **Rationale**: Matches the feature's statuses, rejection behavior, self-approval prohibition, and assumption that a rejected order is cancelled and replaced.
- **Alternatives considered**: Add a `Rejected` PO status (would conflict with the specified lifecycle); allow decision overwrites (would obscure audit history and conflict with final-decision/replacement semantics).
- **Money rule**: Threshold is strictly `totalCents > 1_000_000`; exactly 1,000,000 cents does not require approval. The PO total is quantity × expected unit price and excludes taxes, shipping, discounts, and currency conversion, as specified.
- **Validation interpretation**: FR-006 and edge cases require completeness before submission; User Story 1 acceptance scenario 4 is ambiguous about whether invalid draft saves are also rejected. Planning assumption: drafts may be incomplete, but invalid supplied values are rejected on save and incomplete orders cannot be submitted. Confirm this acceptance interpretation before implementation; no spec change is made here.
- **Quantity assumption**: Use positive whole units for the first release because quantity precision is unspecified. Confirm whether measured/fractional quantities are required before schema/API implementation. Unit price can be zero but not negative.

### Supplier notification delivery

- **Decision**: Define a notification port with separate email and supplier-portal outcomes. Use Nodemailer for email; in local/test use a capture/stream transport as a stub, and require configured SMTP (or an approved Nodemailer transport) for real email delivery. Persist supplier-portal inbox items in SQLite in the submission transaction and expose them through a supplier-scoped API resource for portal consumption.
- **Rationale**: Satisfies both required channels without pretending an absent portal exists. The portal inbox and email intent are transactionally coupled to submission; SMTP delivery stays outside the write transaction. Nodemailer supports multiple transports, including stream-based testing.
- **Alternatives considered**: Email-only delivery (misses the portal requirement); synchronous SMTP inside the transaction (slow and risks holding a write lock); invent a portal service endpoint or broker without evidence it exists (unsupported by this workspace); make portal delivery a no-op (does not satisfy the feature).
- **Integration assumption**: A locally persisted notification inbox is a proposed minimal portal integration surface. The actual supplier portal/auth model is absent; confirm whether it should consume this API, use an existing integration, or own notification storage elsewhere.

### REST, OpenAPI, and contract-first tests

- **Decision**: OpenAPI is the normative public API description, stored as `contracts/openapi.yaml`; expose conventional resource endpoints and explicit action endpoints for submit, approval, fulfill, and cancel. Add contract tests against the document before implementing routes. Use consistent JSON error responses for validation, authorization, missing resources, and illegal transitions.
- **Rationale**: The constitution requires REST and OpenAPI; contract-first tests establish observable behavior before implementation.
- **Alternatives considered**: Generate/maintain API documentation only after routes (reverses the required TDD order); use action-less status mutation endpoints (less explicit and easier to bypass lifecycle rules).
- **OpenAPI version**: Use 3.1.0 as a compatibility baseline for JSON Schema-compatible request/response schemas; adopt a newer supported version only if the host tooling is confirmed to support it.
- **Security assumption**: Document bearer authentication at the API boundary, but reuse the host identity/access-control provider once identified. Buyer, approver, and supplier scopes must be enforced server-side; bearer token format/issuer/claims are not specified by this feature.

### React UI and state

- **Decision**: Build the TypeScript frontend with React; use React Context for feature-level authenticated actor and purchase-order screen state as requested. Keep server state/API interactions in a small typed client; do not add a state-management library by default.
- **Rationale**: Matches the selected architecture and avoids dependencies for a feature with a small set of screens.
- **Alternatives considered**: Global state framework (not justified by current scope); component-local duplicate API state (risks inconsistent status and refresh behavior).
- **Design-system assumption**: No existing design system was found. Implement a responsive, accessible, minimal presentation only after the host UI is identified; do not claim brand/design tokens exist.

### Tests and runtime

- **Decision**: Use Vitest for unit/contract/integration suites and Playwright for browser end-to-end scenarios. Integration tests use the real SQLite driver with a temporary file-backed database. Add OpenAPI contract tests before production code, then verify that failures are for the expected missing behavior.
- **Rationale**: Matches the requested test stack and constitution. Playwright provides a browser-level route through the multi-screen workflow; Vitest is suitable for TypeScript unit and integration tests.
- **Alternatives considered**: Mock SQLite in integration tests (does not exercise SQL, constraints, or transaction behavior); use Playwright for all lower-level tests (slower and less focused).
- **Runtime assumption**: Plan for Node.js 22.12+ because the current Vitest getting-started documentation lists that minimum for its current release line. Confirm the actual runtime and tool versions during project setup.

## Explicit Assumptions / Questions (no unresolved template placeholders)

1. Does the host application provide established package manager/workspace conventions, Node version, Express version, SQLite driver, or design system? None were visible in this workspace.
2. Which source of truth validates branch, supplier, and product IDs? The plan uses a catalog port; it does not create duplicate master data.
3. Does the host provide actor identity and buyer/approver/supplier authorization? The plan requires it and does not invent an identity service.
4. Will the supplier portal consume the proposed supplier-scoped notification inbox API, or must notification delivery integrate with an existing portal?
5. Are fractional quantities needed? Proposed first-release assumption is integer quantity.
6. Should an incomplete draft be saved? The plan permits it; invalid entered values are rejected, and submission always requires a supplier, branch, at least one line, positive quantities, and non-negative unit prices. This reconciles the ambiguous save/submission language conservatively but needs product confirmation.
7. No numeric performance, expected-volume, notification-retention, or delivery-SLA target was supplied.

## References

- SQLite transaction semantics and single-writer behavior: <https://www.sqlite.org/lang_transaction.html>
- OpenAPI Specification (machine-readable, language-agnostic API description): <https://spec.openapis.org/oas/latest.html>
- Nodemailer transports and email sending: <https://nodemailer.com/>
- React `createContext` API: <https://react.dev/reference/react/createContext>
- Vitest getting started: <https://vitest.dev/guide/>
- Playwright Test introduction: <https://playwright.dev/docs/intro>

## Standalone Scaffold Assumptions

The user confirmed that this Spec Kit-only workspace should host a standalone application. The implementation now records Node.js 22.12.0 in `.nvmrc` and selects `better-sqlite3`, npm workspaces, Express 5, React/Vite, Vitest, and Playwright as package defaults. These versions and native SQLite compatibility have not been executed or confirmed because Node.js/npm are not installed in the current environment.

Authentication and catalog remain provider ports; the production entry point intentionally resolves no actor/catalog data until a host adapter is connected. Development fixtures are synthetic, visible, and opt-in. The persisted supplier inbox API is the local portal integration surface described in the original assumption; this does not establish that an external supplier portal consumes it.
