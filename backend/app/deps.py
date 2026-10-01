from fastapi import Header, HTTPException

TRADER_ROLE = "trader"
OPS_ROLE = "ops"


def get_actor_role(x_actor_role: str = Header(default=TRADER_ROLE)) -> str:
    role = x_actor_role.lower().strip()
    if role not in (TRADER_ROLE, OPS_ROLE):
        raise HTTPException(status_code=400, detail="Invalid X-Actor-Role header")
    return role


def require_trader(role: str = Header(default=TRADER_ROLE, alias="X-Actor-Role")) -> str:
    actor_role = get_actor_role(role)
    if actor_role != TRADER_ROLE:
        raise HTTPException(status_code=403, detail="Trader role required")
    return actor_role


def require_ops(role: str = Header(default=TRADER_ROLE, alias="X-Actor-Role")) -> str:
    actor_role = get_actor_role(role)
    if actor_role != OPS_ROLE:
        raise HTTPException(status_code=403, detail="Ops role required")
    return actor_role
