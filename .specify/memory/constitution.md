<!--
Sync Impact Report
Version change: unknown/unset → 1.0.0 (initial project constitution; seven principles established)
Modified principles: unresolved template slots → I. Library-First Reusability; II. Test-Driven Development; III. Real-Database Integration Testing; IV. Simplicity and Direct Framework Use; V. REST and OpenAPI; VI. TypeScript Type Safety; VII. Minimal Dependencies
Added sections: Technology and API Standards; Development Workflow
Removed sections: none
Follow-up TODOs: Confirm the original ratification date and replace TODO(RATIFICATION_DATE).
-->

# OctoCAT Supply Chain Constitution

## Core Principles

### I. Library-First Reusability
Architecture MUST be library-first, with capabilities organized as reusable libraries
to maximize reusability across the project.

### II. Test-Driven Development
Test-driven development is mandatory: write contract tests before implementation,
confirm that they fail for the intended reason, then implement to satisfy them. This
keeps behavior explicit and verifies the contract before production code is shaped by it.

### III. Real-Database Integration Testing
Integration tests MUST be preferred over mocks for validating component behavior and
interactions, and MUST use a real SQLite database. This exercises actual persistence
behavior instead of relying on mocked assumptions.

### IV. Simplicity and Direct Framework Use
Prefer simplicity over abstraction, and use frameworks directly rather than adding
unnecessary abstraction layers. Add abstraction only when a demonstrated need justifies
its complexity.

### V. REST and OpenAPI
HTTP APIs MUST follow REST design conventions and MUST be documented with OpenAPI.
The documentation makes the API contract discoverable and supports contract testing.

### VI. TypeScript Type Safety
Project code MUST use TypeScript to provide static type safety and make interface
expectations explicit.

### VII. Minimal Dependencies
Keep dependencies minimal. Before adding a dependency, evaluate whether it is necessary
and whether the requirement can be met with existing project capabilities or framework
functionality.

## Technology and API Standards

REST API contracts MUST be represented in OpenAPI documentation. TypeScript is the
required language for project code, and SQLite is the real database used by integration
tests. These standards implement the corresponding Core Principles without prescribing
an unrequested framework or library.

## Development Workflow

Contract tests MUST be written before implementation. Integration tests MUST exercise
the real SQLite database rather than replace persistence behavior with mocks. Changes
MUST be reviewed against these principles before acceptance; deviations require a
documented rationale and approval through the project's normal review process.

## Governance

Amendments MUST be proposed as documented changes to this file and reviewed and approved
through the project's normal review process. Every amendment MUST include a Sync Impact
Report during preparation and update the version and last-amended date.

Versioning follows semantic versioning: MAJOR for backward-incompatible removal or
redefinition of governance or principles, MINOR for adding a principle/section or
materially expanding guidance, and PATCH for clarifications and non-semantic wording
changes.

Project changes and reviews MUST be checked for compliance with this constitution.
Any deviation MUST be explicitly justified and approved; unresolved conflicts MUST be
raised during review rather than silently ignored.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown | **Last Amended**: 2026-10-21
