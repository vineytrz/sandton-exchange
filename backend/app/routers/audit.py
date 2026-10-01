from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_actor_role
from app.models import AuditEvent
from app.schemas import AuditEventOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
def list_audit_events(
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    query = db.query(AuditEvent)
    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditEvent.entity_id == entity_id)
    return (
        query.order_by(AuditEvent.created_at.desc()).limit(limit).all()
    )
