import os
import vertexai

# Gemini 2.0 Flash is the primary model as specified by the architecture
MODEL_NAME = "gemini-2.5-flash"

def configure_gemini():
    """Initialize Vertex AI with project and region settings."""
    project_id = os.getenv("GCP_PROJECT_ID", "ashaai-backend")
    location = os.getenv("GCP_LOCATION", "us-central1") # Switched to us-central1 for better quotas
    
    try:
        from google.oauth2 import service_account
        key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "google-service-account.json")
        if os.path.exists(key_path):
            credentials = service_account.Credentials.from_service_account_file(key_path)
            vertexai.init(project=project_id, location=location, credentials=credentials)
            print(f"[OK] Vertex AI initialized with explicit credentials (project={project_id}, location={location})")
        else:
            vertexai.init(project=project_id, location=location)
            print(f"[OK] Vertex AI initialized with ADC (project={project_id}, location={location})")
    except Exception as e:
        print(f"[ERROR] Vertex AI init failed: {e}")
