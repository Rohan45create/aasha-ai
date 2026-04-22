import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import secretmanager

# Global Firestore DB instances
db = None

def initialize_firebase():
    global db
    if not firebase_admin._apps:
        project_id = os.getenv("GCP_PROJECT_ID", "ashaai-prod")
        secret_name = os.getenv("FIREBASE_SECRET_NAME", "firebase-service-account")
        
        try:
            # Try to initialize via Application Default Credentials first (e.g. Cloud Run)
            firebase_admin.initialize_app()
            print("Firebase initialized with Application Default Credentials")
        except ValueError:
            # Fall back to Secret Manager
            try:
                client = secretmanager.SecretManagerServiceClient()
                name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                secret_string = response.payload.data.decode("UTF-8")
                
                cred_dict = json.loads(secret_string)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("Firebase initialized with Secret Manager credentials")
            except Exception as e:
                print(f"Failed to initialize Firebase Config: {e}")
                
    if db is None:
        try:
            db = firestore.AsyncClient()
        except ValueError:
            pass

# Will be initialized by main.py calling initialize_firebase()
