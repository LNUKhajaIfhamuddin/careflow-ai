from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/providers", response_model=List[schemas.UserOut])
def list_providers(
    specialty: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.User).filter(
        models.User.role == models.UserRole.provider,
        models.User.is_active == True,
    )
    if specialty:
        query = query.filter(models.User.specialty == specialty)
    return query.all()
