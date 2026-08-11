# Hooklane

Hooklane is a production-oriented workflow automation platform being built from an existing Stripe and Supabase application.

A workspace can expose inbound webhook endpoints, define versioned workflows, execute steps asynchronously, connect external providers through OAuth, and observe every execution in real time. Stripe billing controls product entitlements and usage limits.

The repository is also a deep engineering study of BullMQ, Redis, WebSockets, OAuth 2.0, Railway, and CI/CD. The application is not disposable tutorial code: each phase should leave behind a coherent system that can be deployed, operated, and extended.

## Product Capabilities

The first complete release will support:

- Supabase authentication and multi-tenant workspaces;
- workspace roles and strict data isolation;
- draft and published workflow versions;
- unique inbound webhook endpoints with optional signature verification;
- condition, HTTP request, delay, and OAuth action steps;
- durable asynchronous execution through BullMQ workers;
- retries, backoff, timeouts, rate limits, concurrency controls, and replay;
- execution history with per-step inputs, outputs, attempts, and errors;
- authenticated live updates with reconnect-safe HTTP reconciliation;
- one complete OAuth provider integration;
- Stripe-backed plans, entitlements, quotas, and usage accounting;
- structured logs, error tracking, health checks, and operational runbooks;
- staging and production-like delivery through GitHub Actions and Railway.

## Existing Foundation

The current repository already includes:

- npm workspaces;
- React 19 and Vite in `apps/web`;
- NestJS 11 in `apps/api`;
- shared TypeScript contracts in `packages/contracts`;
- PostgreSQL access through Drizzle ORM;
- Supabase Auth, migrations, RLS, Storage, and Realtime;
- Stripe Checkout, subscriptions, invoices, refunds, webhooks, Customer Portal, and idempotency-related persistence;
- billing tests, environment validation, request logging, and error handling.

Hooklane will evolve this foundation without deleting working billing behavior or performing a large rewrite.

## Target Architecture

```text
apps/
  web/          Product UI and live execution views
  api/          REST API, auth, inbound webhooks, OAuth callbacks, WebSocket gateway
  worker/       BullMQ consumers and workflow execution runtime
  simulator/    Deterministic external-service simulator for integration checks

packages/
  contracts/    DTOs, schemas, domain events, and versioned job contracts
  database/     Shared schema and database access when extraction is justified
  queue/        Queue names, connection factories, job contracts, and policies
  observability/ Shared logging and correlation primitives when justified

supabase/
  migrations/   Forward-only database migrations
  seeds/        Reproducible local development data

docs/
  implementation-plan.md   Product implementation sequence
  learning-roadmap.md      Deep technology study tracks
  previous-roadmap.md      Archived previous README and roadmap
```

PostgreSQL is the durable source of truth. Redis provides queueing, short-lived coordination, rate limiting, and pub/sub; it does not replace durable product state. WebSocket messages notify clients about changes, while HTTP refetch restores authoritative state.

## Core Execution Flow

```text
Inbound webhook
  -> authenticate/validate endpoint and payload
  -> transactionally persist incoming event and execution
  -> enqueue a small versioned job
  -> return 202 Accepted
  -> worker claims and executes the published workflow version
  -> persist every step attempt and state transition
  -> publish an execution notification
  -> frontend refetches authoritative execution state
```

Example job contract:

```ts
type ExecuteWorkflowJobV1 = {
  version: 1;
  executionId: string;
};
```

Large payloads and mutable workflow definitions are loaded from PostgreSQL, not copied into Redis jobs.

## Engineering Principles

- Build vertical product slices, not disconnected technology demos.
- Design the production-like path first; use failures to verify guarantees, not to justify intentionally poor code.
- Preserve explicit module boundaries and version external contracts.
- Prefer database constraints and transactions over application-only assumptions.
- Treat queue delivery as at-least-once and design external side effects accordingly.
- Keep authorization, tenancy, secrets, and observability in the initial design.
- Use focused automated tests for money, authorization, state transitions, and external side effects.
- Keep migrations backward-compatible with running API and worker versions.
- Make every deployment observable and recoverable.

## Continuous Delivery from the Beginning

Delivery infrastructure grows with the product instead of appearing at the end:

```text
Stage 1  GitHub repository and protected baseline
Stage 2  required pull-request CI
Stage 3  Railway staging for the existing web/API application
Stage 4+ every completed product slice deploys to staging
Stage 7  staging gains Redis and an independently deployed worker
Stage 11 staging provides the real OAuth callback environment
Stage 13 migration, concurrency, observability, smoke, and rollback hardening
Stage 14 controlled production-like promotion and recovery exercise
```

After Stage 3, staging is part of the normal definition of done. Stage 13 is where an already-used pipeline becomes robust; it is not the first deployment.

## Documentation

- [Implementation plan](docs/implementation-plan.md) describes the concrete 14-stage construction of the application.
- [Learning roadmap](docs/learning-roadmap.md) describes how BullMQ, Redis, WebSockets, OAuth, Railway, and CI/CD will be studied in depth while building real features.
- [Environment matrix](docs/environment-matrix.md) records where local, staging, and future production variables belong without storing secrets.
- [Previous roadmap](docs/previous-roadmap.md) preserves the earlier README and billing foundation context.

## Current Status

The Stripe and Supabase billing foundation, Railway staging, CI, workspaces,
versioned workflows, secure inbound webhook endpoints, delivery history, and
the initial Redis rate limiter are implemented. Stage 6 is being closed with
payload redaction and history retention protection. The rate-limiter upgrade
(token bucket/sliding window, Lua atomicity, and response headers) is
intentionally deferred to the reliability hardening work after Stage 9.

Setup commands, environment topology, architecture decisions, and deployment URLs will be documented as they become accurate. The project will use platform-generated HTTPS subdomains; purchasing a domain is not required.
