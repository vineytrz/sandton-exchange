import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def log_event(
    db: Session,
    entity_type: str,
    entity_id: int,
    action: str,
    actor: str,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor=actor,
        payload_json=json.dumps(payload or {}),
    )
    db.add(event)
    return event
