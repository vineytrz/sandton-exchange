# sandton-exchange

A containerized React + FastAPI monolith simulating a trading and back-office settlement system — a deliberately **manual, process-heavy target** for process-discovery, RPA, and agent automation tooling.

> Monolith, REST + polling, T+3 manual settlement, append-only audit trail. Not a modern fintech stack.

## Quick start

**Prerequisites:** Docker, Docker Compose, Make (optional on Windows — run compose commands directly).

```bash
docker compose up --build -d
docker compose exec backend python -m app.seed
```

Open **http://localhost:5173** for the frontend. API docs at **http://localhost:8000/docs**.

### Make targets

| Command | Description |
|---------|-------------|
| `make up` | Build and start all services |
| `make down` | Stop services |
| `make migrate` | Run Alembic migrations manually |
| `make seed` | Load demo data (backfills platform extras on existing DBs) |
| `make test` | Run backend + frontend tests |
| `make logs` | Tail service logs |

## Roles

Use the **Role switcher** in the sidebar (no real authentication):

- **Trader** — place orders, view order book, trade blotter, portfolio
- **Ops** — affirm trades, run settlement batches, manage back-office platform modules

The selected role is sent as the `X-Actor-Role` header on every API request.

## UI pages

| Section | Pages |
|---------|-------|
| **Overview** | Dashboard, Market Overview |
| **Trading** | Order Entry, My Orders, Order Book, Trade Blotter, Portfolio |
| **Back Office** | Trade Affirmation, Settlement, Settlement Fails, Exception Queue, Reconciliation, Corporate Actions, Surveillance, EOD Reporting, Instrument Onboarding, Risk Limits, Audit Log |
| **Reference** | Accounts |

## Core workflow

1. **Place order** → validate (incl. risk limits + instrument approval) → enter order book
2. **Match** — price-time priority matching engine creates trades
3. **Ops affirmation** — manual T+0 trade confirmation
4. **T+3 settlement batch** — Ops runs batch on affirmed trades only
5. **Manual confirm** — Ops confirms each settlement (bulk supported); balances update

Cash and positions reflect **confirmed settlements only** — not instant post-trade updates.

## Platform modules (automation-ready)

Each module is a self-contained back-office process with a UI page, API routes, and audit events — designed as attachment points for agents.

| Module | What it does | Automation opportunity | Risk |
|--------|-------------|------------------------|------|
| **Trade Affirmation** | Counterparty confirms trade terms before settlement | Auto-affirm when terms match tolerance | Medium |
| **Reconciliation** | Compare internal ledger vs custodian feed | Flag position/cash breaks | Low (read-only) |
| **Exception Queue** | Dashboard of anything that didn't go clean | Triage and route (retry-safe vs needs-human) | Low |
| **Settlement Fails** | Trades that miss T+3 | Monitor aging, auto-escalate, draft notices | Medium |
| **Corporate Actions** | Dividends, splits across accounts | Apply adjustment once confirmed | High |
| **Pre-Trade Risk Limits** | Reject orders breaching limits | Independent limit-check agent | Medium |
| **Surveillance** | Wash trades, cancel-ratio patterns | Read-only pattern detection | Low |
| **EOD Reporting** | Daily statements, NAV summaries | Generate and dispatch on schedule | Low |
| **Instrument Onboarding** | New listings need approval before trading | Pre-check against rules checklist | Low |

## API overview

Base URL: `http://localhost:8000/api/v1`

### Trading & settlement

| Endpoint | Description |
|----------|-------------|
| `GET /accounts` | List accounts |
| `GET /accounts/{id}/portfolio` | Cash + settled positions |
| `GET /instruments` | Listed tickers |
| `POST /orders` | Place order (Trader) |
| `GET /orders` | List orders |
| `GET /orders/book/{instrument_id}` | Aggregated order book |
| `POST /orders/{id}/cancel` | Cancel open order |
| `GET /trades` | Trade blotter |
| `GET /trades/pending-affirmation` | Trades awaiting Ops affirmation |
| `POST /trades/{id}/affirm` | Affirm trade (Ops) |
| `GET /settlement/pending` | Pending settlements |
| `POST /settlement/batch` | Create T+3 batch (Ops) |
| `POST /settlement/{id}/confirm` | Confirm settlement (Ops) |
| `POST /settlement/confirm-bulk` | Confirm multiple settlements (Ops) |
| `GET /audit` | Append-only audit trail |
| `GET /ops/dashboard` | Ops queue summary stats |

### Platform / back office

| Endpoint | Description |
|----------|-------------|
| `GET /exceptions` | Aggregated exception queue |
| `GET /recon/breaks` | Open reconciliation breaks |
| `POST /recon/run` | Run EOD recon (Ops) |
| `GET /settlement/fails` | Aging and failed settlements |
| `POST /settlement/{id}/fail` | Mark settlement failed (Ops) |
| `GET /compliance/alerts` | Open compliance alerts |
| `POST /compliance/scan` | Run surveillance scan (Ops) |
| `GET /risk/limits` | Configured risk limits |
| `GET /corporate-actions` | List corporate actions |
| `POST /corporate-actions/{id}/confirm` | Confirm action (Ops) |
| `POST /corporate-actions/{id}/apply` | Apply action across accounts (Ops) |
| `GET /accounts/{id}/statement` | Generate account statement |
| `GET /reporting/eod` | End-of-day summary report |
| `GET /instruments/pending` | Instruments awaiting approval |
| `POST /instruments/onboard` | Submit new listing (Ops) |
| `POST /instruments/{id}/approve` | Approve instrument (Ops) |
| `POST /instruments/{id}/reject` | Reject instrument (Ops) |

## Audit trail (future-phase seam)

Every state transition writes an append-only row to `audit_events`:

- Order placed, validated, rejected (risk/onboarding), matched, cancelled
- Trade created, affirmed
- Settlement batched, confirmed, failed
- Recon run, compliance scan, corporate action confirmed/applied
- Instrument onboarded, approved, rejected

This table plus the stable REST contract are the deliberate attachment points for process-mining / agent tooling in a later phase. **No agent, LangGraph, or process-discovery code lives in this repo.**

## Testing

```bash
# Backend (pytest)
docker compose exec backend pytest -v

# Frontend (Vitest)
docker compose exec frontend npm test -- --run
```

## Explicitly out of scope

- LangGraph / agent framework
- Process mining / discovery logic
- WebSockets (polling only — a modernization gap for later)
- Microservices / per-domain services
- Real authentication

## Database migrations

Schema is managed with **Alembic** (not raw SQL init scripts). Migrations run automatically on backend startup. To apply manually:

```bash
docker compose exec backend alembic upgrade head
```

Current migrations:

| Revision | Description |
|----------|-------------|
| `001` | Initial schema (accounts, instruments, orders, trades, settlements, audit) |
| `002` | Trade affirmation columns |
| `003` | Platform features (recon, risk, corp actions, compliance, onboarding) |

Create a new migration after model changes:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

## Project layout

```
├── docker-compose.yml
├── Makefile
├── frontend/              # Vite + React + TypeScript
│   └── src/pages/         # Dashboard, trading, and back-office pages
└── backend/               # FastAPI + SQLAlchemy + Alembic
    ├── app/
    │   ├── platform_services.py   # Back-office business logic
    │   └── routers/platform.py    # Platform API routes
    └── alembic/           # Migration scripts
```
