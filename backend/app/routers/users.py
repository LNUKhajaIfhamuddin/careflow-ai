from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_, func
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
        spec = specialty.strip().lower()
        # Include specialists matching this department plus Dr. Khaja (attending physician)
        query = query.filter(
            or_(
                func.lower(func.trim(models.User.specialty)) == spec,
                models.User.email == "khaja.provider@gmail.com",
            )
        )
    providers = query.all()
    # Sort so Dr. Khaja Provider is prominently first
    providers.sort(key=lambda u: (0 if u.email == "khaja.provider@gmail.com" else 1, u.full_name))
    return providers
