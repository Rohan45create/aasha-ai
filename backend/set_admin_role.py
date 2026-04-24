"""
One-time script to set a user's role in Firebase.
Usage: python set_admin_role.py
"""
import os
import sys
import firebase_admin
from firebase_admin import credentials, auth

def set_role(uid, role):
    if not firebase_admin._apps:
        base_path = os.path.dirname(os.path.abspath(__file__))
        sa_path = os.path.join(base_path, "firebase-service-account.json")
        try:
            cred = credentials.Certificate(sa_path)
        except Exception:
            try:
                cred = credentials.ApplicationDefault()
            except Exception as e:
                print(f"FAILED: Could not initialize Firebase Admin SDK.")
                print(f"Make sure firebase-service-account.json is in the backend/ folder.")
                print(f"Error: {e}")
                return
        firebase_admin.initialize_app(cred)

    valid_roles = ["asha_worker", "asha_head", "admin"]
    if role not in valid_roles:
        print(f"Invalid role '{role}'. Choose from: {valid_roles}")
        return

    try:
        auth.set_custom_user_claims(uid, {"role": role, "district": "Beed"})
        print(f"SUCCESS: Set role={role} for uid={uid}")
        print("")
        print("Now do this:")
        print("1. Open your browser")
        print("2. Press F12 -> Application tab -> Storage -> Clear site data")
        print("3. Go to localhost:5173/admin/login and sign in with Google again")
        print("4. You should now reach the admin dashboard")
    except Exception as e:
        print(f"FAILED to set claims: {e}")
        print("Make sure the user has signed in at least once.")

if __name__ == "__main__":
    print("=== AshaAI Role Setter ===")
    print("Get your UID from: Firebase Console -> Authentication -> Users tab")
    print("")
    
    if len(sys.argv) >= 3:
        uid_arg = sys.argv[1]
        role_arg = sys.argv[2]
    else:
        uid_arg = input("Paste your Firebase UID: ").strip()
        print("Roles: asha_worker | asha_head | admin")
        role_arg = input("Enter role: ").strip()
    
    if not uid_arg:
        print("UID cannot be empty.")
        sys.exit(1)
    
    set_role(uid_arg, role_arg)