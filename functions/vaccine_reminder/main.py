"""
Vaccine Reminder — Cloud Function
Triggered by Cloud Scheduler at 7am IST daily.

Checks NVHCP (National Vaccination Health Check Programme) schedule 
for all registered children and sends FCM push notifications 
for due/overdue vaccines.
"""
import functions_framework
import firebase_admin
from firebase_admin import firestore, messaging
from datetime import datetime, date, timedelta

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# NVHCP Vaccination Schedule (age in weeks/months → vaccine)
NVHCP_SCHEDULE = [
    {"age_weeks": 0, "vaccine": "BCG + OPV-0 + Hep B Birth Dose", "dose": 1},
    {"age_weeks": 6, "vaccine": "Pentavalent + OPV + Rotavirus + fIPV + PCV", "dose": 1},
    {"age_weeks": 10, "vaccine": "Pentavalent + OPV + Rotavirus", "dose": 2},
    {"age_weeks": 14, "vaccine": "Pentavalent + OPV + Rotavirus + fIPV + PCV", "dose": 3},
    {"age_months": 9, "vaccine": "MR-1 + JE-1 + PCV Booster", "dose": 1},
    {"age_months": 16, "vaccine": "MR-2 + JE-2 + DPT Booster-1 + OPV Booster", "dose": 1},
    {"age_months": 60, "vaccine": "DPT Booster-2", "dose": 1},
]


def get_due_vaccines(dob: date, administered_vaccines: list) -> list:
    """
    Compare child's age against NVHCP schedule to find due/overdue vaccines.
    """
    today = date.today()
    age_days = (today - dob).days
    age_weeks = age_days // 7
    age_months = age_days // 30

    due = []
    administered_names = [v.get("vaccine_name", "") for v in administered_vaccines]

    for entry in NVHCP_SCHEDULE:
        vaccine_name = entry["vaccine"]

        # Check if already administered
        if any(vaccine_name.lower() in a.lower() for a in administered_names):
            continue

        # Check if due by age
        due_age_weeks = entry.get("age_weeks")
        due_age_months = entry.get("age_months")

        is_due = False
        overdue_days = 0

        if due_age_weeks is not None and age_weeks >= due_age_weeks:
            is_due = True
            overdue_days = max(0, age_days - (due_age_weeks * 7) - 7)  # 1 week grace
        elif due_age_months is not None and age_months >= due_age_months:
            is_due = True
            overdue_days = max(0, age_days - (due_age_months * 30) - 14)  # 2 week grace

        if is_due:
            due.append({
                "vaccine": vaccine_name,
                "dose": entry["dose"],
                "overdue_days": overdue_days,
                "is_overdue": overdue_days > 0,
            })

    return due


def send_fcm_notification(device_token: str, title: str, body: str, data: dict = None):
    """Send a push notification via FCM."""
    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=device_token,
        )
        messaging.send(message)
    except Exception as e:
        # Token may be invalid/expired — don't crash
        pass


@functions_framework.http
def vaccine_reminder(request):
    """
    Cloud Function: Check all children for due vaccines and send FCM reminders.
    Triggered daily at 7am IST via Cloud Scheduler.
    """
    reminders_sent = 0
    children_checked = 0
    errors = 0

    try:
        children_ref = db.collection("children").stream()

        for doc in children_ref:
            try:
                child = doc.to_dict()
                children_checked += 1

                dob_raw = child.get("date_of_birth")
                if not dob_raw:
                    continue

                # Parse DOB
                if isinstance(dob_raw, str):
                    dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                else:
                    dob = dob_raw

                # Get administered vaccines
                vacc_docs = db.collection("vaccinations").where(
                    "child_id", "==", doc.id
                ).stream()
                administered = [v.to_dict() for v in vacc_docs]

                # Check due vaccines
                due = get_due_vaccines(dob, administered)

                if due:
                    asha_id = child.get("asha_id", "")
                    child_name = child.get("child_name", "Child")

                    # Get ASHA's FCM token
                    asha_doc = db.collection("ashas").document(asha_id).get()
                    if asha_doc.exists:
                        asha_data = asha_doc.to_dict()
                        fcm_token = asha_data.get("fcm_token")

                        if fcm_token:
                            overdue_vaccines = [v for v in due if v["is_overdue"]]
                            due_vaccines = [v for v in due if not v["is_overdue"]]

                            if overdue_vaccines:
                                title = f"⚠️ Overdue Vaccine — {child_name}"
                                body = f"{overdue_vaccines[0]['vaccine']} is overdue by {overdue_vaccines[0]['overdue_days']} days"
                            else:
                                title = f"💉 Vaccine Due — {child_name}"
                                body = f"{due_vaccines[0]['vaccine']} is now due"

                            send_fcm_notification(
                                fcm_token, title, body,
                                data={"child_id": doc.id, "type": "vaccine_reminder"},
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
