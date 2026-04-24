import firebase_admin
from firebase_admin import credentials, firestore, storage
from datetime import datetime, timedelta, timezone
import logging

try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
except Exception as e:
    logging.warning("App already initialized or missing env.")

# Assumes we use default app initialized in main

def cleanup_old_ocr_images():
    """
    Cron job function to delete OCR photos uploaded > 72h ago
    """
    logging.info("Starting cron cleanup of old OCR images...")
    try:
        bucket = storage.bucket()
        blobs = bucket.list_blobs(prefix='ocr_uploads/')
        now = datetime.now(timezone.utc)
        count = 0
        
        for blob in blobs:
            if blob.updated:
                age_hours = (now - blob.updated).total_seconds() / 3600
                if age_hours > 72:
                    blob.delete()
                    count += 1
        
        logging.info(f"Cleanup complete. Deleted {count} OCR images older than 72 hours.")
        return {"status": "success", "deleted": count}
    except Exception as e:
        logging.error(f"Error during cleanup: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    cleanup_old_ocr_images()
