from google.cloud import firestore
import structlog

logger = structlog.get_logger()

# We initialize it lazily or globally
try:
    db = firestore.Client()
except Exception as e:
    logger.warning("firestore_client_init_failed", error=str(e))
    db = None

class FirestoreService:
    @staticmethod
    def get_document(collection: str, doc_id: str):
        try:
            doc_ref = db.collection(collection).document(doc_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error("firestore_get_error", error=str(e), collection=collection, doc_id=doc_id)
            raise e

    @staticmethod
    def set_document(collection: str, doc_id: str, data: dict):
        try:
            db.collection(collection).document(doc_id).set(data, merge=True)
            return True
        except Exception as e:
            logger.error("firestore_set_error", error=str(e), collection=collection, doc_id=doc_id)
            raise e
