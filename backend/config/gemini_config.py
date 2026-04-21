import os
import vertexai

# Gemini 2.0 Flash is the primary model as specified by the architecture
MODEL_NAME = "gemini-2.0-flash-exp"

def configure_gemini():
    """Initialize Vertex AI with project and region settings."""
    project_id = os.getenv("GCP_PROJECT_ID", "ashaai-prod")
    location = os.getenv("GCP_LOCATION", "asia-south1")
    try:
        vertexai.init(project=project_id, location=location)
        print(f"✓ Vertex AI initialized (project={project_id}, location={location})")
    except Exception as e:
        print(f"✗ Vertex AI init failed: {e}")
