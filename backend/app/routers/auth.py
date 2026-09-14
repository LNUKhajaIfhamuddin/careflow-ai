from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    # Rate-limited to slow down automated account-creation abuse.
    enforce_rate_limit(f"register:{request.client.host}", limit=10, window_seconds=300)

    # payload.email is already normalized (stripped + lowercased) by the
    # UserCreate validator, so this comparison is now case-insensitive —
    # fixes a bug where "Jane@x.com" and "jane@x.com" could both register.
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # payload.role is a PublicRole (patient/provider only — admin is
    # deliberately excluded from the public schema). Explicitly map it onto
    # the internal UserRole so the two enums never get silently conflated.
    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=auth.hash_password(payload.password),
        role=models.UserRole(payload.role.value),
        specialty=payload.specialty if payload.role == schemas.PublicRole.provider else None,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        # Rate-limit failed attempts per client IP to mitigate brute-force password guessing.
        enforce_rate_limit(f"login:{request.client.host}", limit=10, window_seconds=300)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
