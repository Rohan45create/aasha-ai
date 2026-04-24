import sys
import firebase_admin
from firebase_admin import credentials, auth

def grant_admin_claim(email: str, role: str = 'admin'):
    # Initialize the app with default credentials (must be authenticated with gcloud or have GOOGLE_APPLICATION_CREDENTIALS)
    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {'projectId': 'ashaai-prod'})
    except Exception as e:
        print(f"Failed to initialize Firebase Admin SDK. Did you follow the Service Account steps in CONFIG_CHECKLIST? Error: {e}")
        return

    try:
        user = auth.get_user_by_email(email)
        # Update custom claims
        current_claims = user.custom_claims or {}
        current_claims['role'] = role
        auth.set_custom_user_claims(user.uid, current_claims)
        print(f"Successfully granted '{role}' role to user {email} (UID: {user.uid}).")
        print("Please log out and log back in on the Admin Dashboard to refresh your token claims.")
    except Exception as e:
        print(f"Failed to grant admin claim to {email}. Error: {e}")
        print("Make sure the user has already signed in at least once so their account exists in Firebase Authentication.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python grant_admin.py <user_email> [role]")
        print("Example: python grant_admin.py myemail@gmail.com admin")
        sys.exit(1)
    
    email_arg = sys.argv[1]
    role_arg = sys.argv[2] if len(sys.argv) > 2 else 'admin'
    grant_admin_claim(email_arg, role_arg)
