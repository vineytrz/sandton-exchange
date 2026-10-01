import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_MIGRATIONS"] = "1"

from app.database import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_data(db):
    from app.models import Account, Instrument

    inst = Instrument(ticker="NPN", name="Naspers", last_price=100.0, currency="ZAR")
    db.add(inst)
    acct_a = Account(name="Trader A", role_hint="trader", cash_balance=1_000_000.0)
    acct_b = Account(name="Trader B", role_hint="trader", cash_balance=1_000_000.0)
    db.add_all([acct_a, acct_b])
    db.commit()
    db.refresh(inst)
    db.refresh(acct_a)
    db.refresh(acct_b)
    return {"instrument": inst, "trader_a": acct_a, "trader_b": acct_b}
