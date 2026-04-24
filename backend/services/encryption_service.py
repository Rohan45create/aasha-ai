"""
AES-256-GCM Encryption Service for Aadhaar and ABHA IDs.

Key is loaded from GCP Secret Manager — NEVER from .env or code.
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import structlog

logger = structlog.get_logger()

_cached_key: bytes | None = None


def get_encryption_key() -> bytes:
    """
    Retrieve Aadhaar encryption key from GCP Secret Manager.
    Caches the key in memory after first retrieval.
    """
    global _cached_key
    if _cached_key is not None:
        return _cached_key

    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        project_id = os.getenv("GCP_PROJECT_ID", "ashaai-prod")
        secret_name = f"projects/{project_id}/secrets/aadhaar-encryption-key/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        _cached_key = base64.b64decode(response.payload.data)
        logger.info("encryption_key_loaded")
        return _cached_key
    except Exception as e:
        logger.error("encryption_key_load_failed", error=str(e))
        # Fallback for local development only — generate a key
        # In production this MUST come from Secret Manager
        if os.getenv("ENVIRONMENT", "development") == "development":
            logger.warning("using_dev_fallback_encryption_key")
            _cached_key = AESGCM.generate_key(bit_length=256)
            return _cached_key
        raise


def encrypt_aadhaar(aadhaar: str) -> str:
    """
    Encrypt an Aadhaar number with AES-256-GCM before Firestore storage.
    
    Returns: base64-encoded string containing nonce + ciphertext.
    """
    if not aadhaar or len(aadhaar) < 4:
        return ""

    key = get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit random nonce
    ciphertext = aesgcm.encrypt(nonce, aadhaar.encode("utf-8"), None)
    # Store nonce + ciphertext together
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_aadhaar(encrypted_str: str) -> str:
    """
    Decrypt an Aadhaar number from Firestore.
    This should ONLY be called server-side for specific admin operations.
    Never return the full number to the frontend.
    """
    if not encrypted_str:
        return ""

    key = get_encryption_key()
    data = base64.b64decode(encrypted_str)
    nonce = data[:12]
    ciphertext = data[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")


def mask_aadhaar(aadhaar: str) -> str:
    """
    Returns XXXX-XXXX-1234 format for UI display.
    Only the last 4 digits are shown.
    """
    if not aadhaar or len(aadhaar) < 4:
        return "XXXX-XXXX-XXXX"
    return f"XXXX-XXXX-{aadhaar[-4:]}"


def mask_abha(abha_id: str) -> str:
    """
    Returns XX-XXXX-XXXX-1234 format for ABHA ID display.
    """
    if not abha_id or len(abha_id) < 4:
        return "XX-XXXX-XXXX-XXXX"
    return f"XX-XXXX-XXXX-{abha_id[-4:]}"
