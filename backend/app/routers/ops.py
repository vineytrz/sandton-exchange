from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_actor_role
from app.schemas import OpsDashboardOut
from app.services import get_ops_dashboard

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/dashboard", response_model=OpsDashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    return OpsDashboardOut(**get_ops_dashboard(db))
