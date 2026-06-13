import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import structlog

logger = structlog.get_logger()

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via Gmail SMTP. Returns True on success, False on failure (never raises)."""
    sender_email = os.getenv("GMAIL_SENDER_EMAIL")
    sender_password = os.getenv("GMAIL_APP_PASSWORD")

    if not sender_email or not sender_password:
        logger.warning("email_not_configured", to=to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"AshaAI <{sender_email}>"
        msg["To"] = to_email

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())

        logger.info("email_sent", to=to_email, subject=subject)
        return True
    except Exception as e:
        logger.error("email_send_failed", to=to_email, error=str(e))
        return False


def build_appointment_email(ngo_name: str, scheduled_date: str, scheduled_time: str, purpose: str, change_url: str) -> str:
    """Build a professional HTML email for an NGO visit appointment."""
    return f"""\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#F5F4EF;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F4EF;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E3DC;">
          <tr>
            <td style="background-color:#085041;padding:24px 32px;">
              <span style="color:#FFFFFF;font-size:20px;font-weight:700;">asha<span style="color:#1D9E75;">ai</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1F2937;font-size:18px;">Visit Scheduled — {ngo_name}</h2>
              <p style="margin:0 0 20px;color:#4B5563;font-size:14px;line-height:1.6;">
                Hello,<br><br>
                An ASHA worker has been scheduled to visit your facility, <strong>{ngo_name}</strong>, as part of routine child health monitoring.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EAF3DE;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#27500A;font-size:13px;font-weight:600;">VISIT DETAILS</p>
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
                      📅 Date: <strong>{scheduled_date}</strong><br>
                      🕐 Time: <strong>{scheduled_time}</strong><br>
                      📋 Purpose: <strong>{purpose}</strong>
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;color:#4B5563;font-size:14px;line-height:1.6;">
                If this date or time doesn't work for your facility, you can request a different date below.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#1D9E75;">
                    <a href="{change_url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Reschedule Appointment
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#9CA3AF;font-size:12px;line-height:1.5;">
                This is an automated message from AshaAI, a digital platform supporting ASHA frontline health workers in Maharashtra. If you have questions, please contact your assigned ASHA supervisor.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def build_reschedule_confirmation_email(ngo_name: str, new_date: str, new_time: str) -> str:
    """Build a confirmation email after admin approves a reschedule request."""
    return f"""\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#F5F4EF;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F4EF;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E3DC;">
          <tr>
            <td style="background-color:#085041;padding:24px 32px;">
              <span style="color:#FFFFFF;font-size:20px;font-weight:700;">asha<span style="color:#1D9E75;">ai</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1F2937;font-size:18px;">Appointment Confirmed — {ngo_name}</h2>
              <p style="margin:0 0 20px;color:#4B5563;font-size:14px;line-height:1.6;">
                Hello,<br><br>
                Your requested date change has been confirmed. The ASHA worker visit to <strong>{ngo_name}</strong> is now scheduled as follows:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EAF3DE;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
                      📅 New Date: <strong>{new_date}</strong><br>
                      🕐 New Time: <strong>{new_time}</strong>
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.5;">
                This is an automated message from AshaAI. If you have questions, please contact your assigned ASHA supervisor.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
