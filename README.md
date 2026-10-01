# sandton-exchange

A containerized React + FastAPI monolith simulating a JSE-style trading and back-office settlement system — a deliberately **legacy target** for process-discovery, RPA, and agent automation tooling.

> Legacy back office, not a modern fintech stack: monolith, REST + polling, T+3 manual settlement, append-only audit trail.

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
| `make seed` | Load JSE demo data |
| `make test` | Run backend + frontend tests |
| `make logs` | Tail service logs |

## Roles

Use the **Role switcher** in the header (no real authentication):

- **Trader** — place orders, view order book, trade blotter, portfolio
- **Ops** — batch T+3 settlements and manually confirm them (the intentional legacy friction point)

The selected role is sent as the `X-Actor-Role` header on every API request.

## Workflow

1. **Place order** → validate → enter order book
2. **Match** — price-time priority matching engine creates trades
3. **Ops affirmation** — manual T+0 trade confirmation (new gate)
4. **T+3 settlement batch** — Ops runs batch on affirmed trades only
5. **Manual confirm** — Ops confirms each settlement (bulk supported); balances update

Cash and positions reflect **confirmed settlements only** — not instant post-trade updates.

## API overview

Base URL: `http://localhost:8000/api/v1`

| Endpoint | Description |
|----------|-------------|
| `GET /accounts` | List accounts |
| `GET /accounts/{id}/portfolio` | Cash + settled positions |
| `GET /instruments` | JSE-style tickers |
| `POST /orders` | Place order (Trader) |
| `GET /orders` | List orders |
| `GET /orders/book/{instrument_id}` | Aggregated order book |
| `POST /orders/{id}/cancel` | Cancel open order |
| `GET /trades` | Trade blotter |
| `GET /trades/pending-affirmation` | Trades awaiting Ops affirmation |
| `POST /trades/{id}/affirm` | Affirm trade (Ops) |
| `GET /settlement/pending` | Pending settlements |
| `POST /settlement/batch` | Create T+3 batch (Ops, affirmed trades only) |
| `POST /settlement/{id}/confirm` | Confirm settlement (Ops) |
| `POST /settlement/confirm-bulk` | Confirm multiple settlements (Ops) |
| `GET /audit` | Append-only audit trail |
| `GET /ops/dashboard` | Ops queue summary stats |

## Audit trail (future-phase seam)

Every state transition writes an append-only row to `audit_events`:

- Order placed, validated, matched, cancelled
- Trade created
- Settlement batched, confirmed

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

Create a new migration after model changes:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

## Project layout

```
├── docker-compose.yml
├── Makefile
├── frontend/          # Vite + React + TypeScript
└── backend/           # FastAPI + SQLAlchemy + Alembic
    └── alembic/       # Migration scripts
```
