import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.migrations import run_migrations
from app.routers import accounts, audit, ops, orders, settlement, trades

app = FastAPI(title="Sandton Exchange", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    if os.getenv("SKIP_MIGRATIONS") != "1":
        run_migrations()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(orders.router, prefix="/api/v1")
app.include_router(trades.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(settlement.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(ops.router, prefix="/api/v1")
