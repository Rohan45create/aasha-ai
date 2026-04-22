from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from middleware.auth_middleware import verify_firebase_token
import base64
import os

router = APIRouter(prefix="/api/security", tags=["security"])

class AadhaarRequest(BaseModel):
    aadhaar: str

class AadhaarResponse(BaseModel):
    encrypted: str
    masked: str  # XXXX-XXXX-1234 for UI display

# Fallback basic encryption for demo/local if Secret Manager isn't working
def simple_encrypt(text: str) -> str:
    # Extremely basic b64 for demo purposes; real app uses Google Secret Manager
    return "ENC:" + base64.b64encode(text.encode()).decode()

def get_masked(text: str) -> str:
    if len(text) >= 4:
        return f"XXXX-XXXX-{text[-4:]}"
    return "XXXX-XXXX-XXXX"

@router.post("/encrypt-aadhaar", response_model=AadhaarResponse)
async def encrypt_aadhaar(
    req: AadhaarRequest,
    current_user=Depends(verify_firebase_token)
):
    # Validate format (at least 4 digits for masked or 12 for full)
    if "X" not in req.aadhaar and (not req.aadhaar.isdigit() or len(req.aadhaar) != 12):
        raise HTTPException(400, "Aadhaar must be 12 digits")
    
    # In a production app, we would use services.encryption_service (GCP Secret Manager)
    # Since we are setting this up, we'll use a basic encoding for placeholder
    encrypted_val = simple_encrypt(req.aadhaar)
    masked_val = get_masked(req.aadhaar)
    
    return AadhaarResponse(
        encrypted=encrypted_val,
        masked=masked_val
    )
