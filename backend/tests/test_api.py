from app.models import Account, AuditEvent


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_order_lifecycle_and_match(client, seed_data):
    inst = seed_data["instrument"]
    a = seed_data["trader_a"]
    b = seed_data["trader_b"]

    sell = client.post(
        "/api/v1/orders",
        json={
            "account_id": b.id,
            "instrument_id": inst.id,
            "side": "SELL",
            "qty": 100,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )
    assert sell.status_code == 200
    assert sell.json()["status"] == "OPEN"

    buy = client.post(
        "/api/v1/orders",
        json={
            "account_id": a.id,
            "instrument_id": inst.id,
            "side": "BUY",
            "qty": 100,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )
    assert buy.status_code == 200
    assert buy.json()["status"] == "FILLED"

    trades = client.get("/api/v1/trades", headers={"X-Actor-Role": "trader"})
    assert trades.status_code == 200
    assert len(trades.json()) == 1


def test_audit_events_written(client, seed_data, db):
    inst = seed_data["instrument"]
    a = seed_data["trader_a"]

    client.post(
        "/api/v1/orders",
        json={
            "account_id": a.id,
            "instrument_id": inst.id,
            "side": "BUY",
            "qty": 10,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )

    count = db.query(AuditEvent).count()
    assert count >= 3  # placed, validated, open


def test_settlement_confirm_ops_only(client, seed_data, db):
    inst = seed_data["instrument"]
    a = seed_data["trader_a"]
    b = seed_data["trader_b"]

    client.post(
        "/api/v1/orders",
        json={
            "account_id": b.id,
            "instrument_id": inst.id,
            "side": "SELL",
            "qty": 50,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )
    client.post(
        "/api/v1/orders",
        json={
            "account_id": a.id,
            "instrument_id": inst.id,
            "side": "BUY",
            "qty": 50,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )

    batch = client.post(
        "/api/v1/settlement/batch",
        headers={"X-Actor-Role": "trader"},
    )
    assert batch.status_code == 403

    batch = client.post(
        "/api/v1/settlement/batch",
        headers={"X-Actor-Role": "ops"},
    )
    assert batch.status_code == 200
    settlement_id = batch.json()[0]["id"]

    cash_before = db.query(Account).filter_by(id=a.id).first().cash_balance

    confirm = client.post(
        f"/api/v1/settlement/{settlement_id}/confirm",
        headers={"X-Actor-Role": "ops"},
    )
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "CONFIRMED"

    db.refresh(a)
    assert a.cash_balance < cash_before


def test_order_cancel(client, seed_data):
    inst = seed_data["instrument"]
    a = seed_data["trader_a"]

    created = client.post(
        "/api/v1/orders",
        json={
            "account_id": a.id,
            "instrument_id": inst.id,
            "side": "BUY",
            "qty": 10,
            "price": 50.0,
        },
        headers={"X-Actor-Role": "trader"},
    )
    order_id = created.json()["id"]

    cancelled = client.post(
        f"/api/v1/orders/{order_id}/cancel",
        headers={"X-Actor-Role": "trader"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"


def test_portfolio(client, seed_data, db):
    inst = seed_data["instrument"]
    a = seed_data["trader_a"]
    b = seed_data["trader_b"]

    client.post(
        "/api/v1/orders",
        json={
            "account_id": b.id,
            "instrument_id": inst.id,
            "side": "SELL",
            "qty": 10,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )
    client.post(
        "/api/v1/orders",
        json={
            "account_id": a.id,
            "instrument_id": inst.id,
            "side": "BUY",
            "qty": 10,
            "price": 100.0,
        },
        headers={"X-Actor-Role": "trader"},
    )

    batch = client.post(
        "/api/v1/settlement/batch",
        headers={"X-Actor-Role": "ops"},
    )
    settlement_id = batch.json()[0]["id"]
    client.post(
        f"/api/v1/settlement/{settlement_id}/confirm",
        headers={"X-Actor-Role": "ops"},
    )

    portfolio = client.get(
        f"/api/v1/accounts/{a.id}/portfolio",
        headers={"X-Actor-Role": "trader"},
    )
    assert portfolio.status_code == 200
    data = portfolio.json()
    assert data["account_id"] == a.id
    assert len(data["positions"]) == 1
    assert data["positions"][0]["qty"] == 10
