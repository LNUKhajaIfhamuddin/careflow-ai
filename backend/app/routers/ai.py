from fastapi import APIRouter, Depends

from .. import schemas, auth, ai_service, models

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/symptom-intake", response_model=schemas.SymptomIntakeResponse)
def symptom_intake(
    payload: schemas.SymptomIntakeRequest,
    current_user: models.User = Depends(auth.get_current_user),
):
    return ai_service.analyze_symptoms(payload.symptom_text)
