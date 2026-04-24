"""
NRC Followup Check — Cloud Function
Triggered by Cloud Scheduler at 8am IST daily.

Checks children who were admitted to NRC (Nutrition Rehabilitation Centre)
and sends post-discharge follow-up reminders to ASHA workers.
"""
import functions_framework
import firebase_admin
from firebase_admin import firestore, messaging
from datetime import datetime, date, timedelta

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# Follow-up schedule after NRC discharge (days after discharge)
FOLLOWUP_SCHEDULE = [3, 7, 14, 30, 60, 90]


def send_fcm_notification(device_token: str, title: str, body: str, data: dict = None):
    """Send a push notification via FCM."""
    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=device_token,
        )
        messaging.send(message)
    except Exception:
        pass


@functions_framework.http
def nrc_followup_check(request):
    """
    Check for NRC-discharged children who need follow-up visits.
    Sends FCM reminders to their assigned ASHA workers.
    """
    reminders_sent = 0
    children_checked = 0
    errors = 0

    try:
        # Query children with NRC referral status
        nrc_docs = db.collection("children").where(
            "nrc_status", "in", ["DISCHARGED", "FOLLOW_UP"]
        ).stream()

        today = date.today()

        for doc in nrc_docs:
            try:
                child = doc.to_dict()
                children_checked += 1

                discharge_date_raw = child.get("nrc_discharge_date")
                if not discharge_date_raw:
                    continue

                # Parse discharge date
                if isinstance(discharge_date_raw, str):
                    discharge_date = datetime.strptime(discharge_date_raw, "%Y-%m-%d").date()
                else:
                    discharge_date = discharge_date_raw

                days_since_discharge = (today - discharge_date).days

                # Check if today matches any follow-up schedule day (±1 day tolerance)
                due_followup = None
                for followup_day in FOLLOWUP_SCHEDULE:
                    if abs(days_since_discharge - followup_day) <= 1:
                        due_followup = followup_day
                        break

                if due_followup is None:
                    continue

                # Check if this follow-up was already completed
                completed_followups = child.get("completed_followups", [])
                if due_followup in completed_followups:
                    continue

                # Send reminder to ASHA
                asha_id = child.get("asha_id", "")
                child_name = child.get("child_name", "Child")

                asha_doc = db.collection("ashas").document(asha_id).get()
                if asha_doc.exists:
                    asha_data = asha_doc.to_dict()
                    fcm_token = asha_data.get("fcm_token")

                    if fcm_token:
                        title = f"🏥 NRC Follow-up — {child_name}"
                        body = f"Day {due_followup} follow-up visit due. Check weight and feeding."

                        send_fcm_notification(
                            fcm_token, title, body,
                            data={
                                "child_id": doc.id,
                                "type": "nrc_followup",
                                "followup_day": str(due_followup),
                            },
                        )
                        reminders_sent += 1

            except Exception as e:
                errors += 1

    except Exception as e:
        return {"status": "error", "error": str(e)}, 500

    return {
        "status": "success",
        "children_checked": children_checked,
        "reminders_sent": reminders_sent,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
    }
