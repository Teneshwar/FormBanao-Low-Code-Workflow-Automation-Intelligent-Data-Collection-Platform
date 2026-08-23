"""
Email notification service using aiosmtplib.

Configuration (add to .env):
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your@gmail.com
    SMTP_PASSWORD=your_app_password
    SMTP_FROM=your@gmail.com
    NOTIFICATIONS_ENABLED=true

If NOTIFICATIONS_ENABLED is false or SMTP_USER is not set, all send
calls are silently skipped so the app works without email config.
"""
from __future__ import annotations

import asyncio
import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SMTP_HOST             = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT             = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER             = os.getenv("SMTP_USER", "")
SMTP_PASSWORD         = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM             = os.getenv("SMTP_FROM", SMTP_USER)
NOTIFICATIONS_ENABLED = os.getenv("NOTIFICATIONS_ENABLED", "false").lower() == "true"


def _is_configured() -> bool:
    return NOTIFICATIONS_ENABLED and bool(SMTP_USER) and bool(SMTP_PASSWORD)


# â”€â”€ Core send helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async def _send(to: str, subject: str, html: str, text: str) -> None:
    """Send an email. Silently logs and returns on any failure."""
    if not _is_configured():
        logger.debug("Notifications disabled or SMTP not configured â€” skipping email to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = SMTP_FROM
    msg["To"]      = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)


def fire_and_forget(coro: object) -> None:
    """
    Schedule a coroutine on the running event loop without awaiting it.
    Safe to call from sync FastAPI route handlers â€” if no loop is running
    the notification is simply skipped (never crashes the request).
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)  # type: ignore[arg-type]
    except RuntimeError:
        # No running loop (e.g. during tests) â€” skip silently
        pass


# â”€â”€ Notification templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def send_welcome_email(to_email: str, full_name: Optional[str]) -> None:
    name    = full_name or to_email
    subject = "Welcome to Enterprise Form Builder"
    html = (
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">'
        f'<h1 style="color:#2563eb;margin-bottom:8px">Welcome, {name}! &#128075;</h1>'
        '<p style="color:#374151">Your account has been created successfully.</p>'
        '<p style="color:#374151">You can now:</p>'
        '<ul style="color:#374151">'
        "<li>Create and publish forms</li>"
        "<li>Collect responses</li>"
        "<li>Schedule form availability windows</li>"
        "</ul>"
        '<p style="color:#6b7280;font-size:13px;margin-top:32px">Enterprise Form Builder</p>'
        "</div>"
    )
    text = f"Welcome, {name}!\n\nYour account has been created successfully.\n\nEnterprise Form Builder"
    await _send(to_email, subject, html, text)


async def send_submission_notification(
    owner_email: str,
    owner_name: Optional[str],
    form_title: str,
    form_uuid: str,
    submission_id: int,
    submitted_by: Optional[str],
) -> None:
    name      = owner_name or owner_email
    submitter = submitted_by or "Anonymous"
    subject   = f'New response on "{form_title}"'
    view_url  = f"http://localhost:5173/forms/{form_uuid}/submissions"
    html = (
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">'
        '<h2 style="color:#2563eb;margin-bottom:4px">New Form Response</h2>'
        f'<p style="color:#374151">Hi {name},</p>'
        f'<p style="color:#374151">Response <strong>#{submission_id}</strong> was submitted'
        f' to <strong>{form_title}</strong> by <strong>{submitter}</strong>.</p>'
        f'<a href="{view_url}" style="display:inline-block;margin-top:16px;padding:10px 20px;'
        'background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-size:14px">'
        "View Responses</a>"
        '<p style="color:#6b7280;font-size:13px;margin-top:32px">Enterprise Form Builder</p>'
        "</div>"
    )
    text = (
        f"Hi {name},\n\n"
        f'New response #{submission_id} on "{form_title}" from {submitter}.\n\n'
        "Enterprise Form Builder"
    )
    await _send(owner_email, subject, html, text)


async def send_form_published_notification(
    owner_email: str,
    owner_name: Optional[str],
    form_title: str,
    form_uuid: str,
) -> None:
    name       = owner_name or owner_email
    subject    = f'Your form "{form_title}" is now live'
    public_url = f"http://localhost:5173/public/{form_uuid}"
    html = (
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">'
        '<h2 style="color:#16a34a;margin-bottom:4px">Form Published &#10003;</h2>'
        f'<p style="color:#374151">Hi {name},</p>'
        f'<p style="color:#374151">Your form <strong>{form_title}</strong> is now live'
        " and accepting responses.</p>"
        '<p style="color:#374151">Share this link:</p>'
        f'<a href="{public_url}" style="color:#2563eb;word-break:break-all">{public_url}</a>'
        '<p style="color:#6b7280;font-size:13px;margin-top:32px">Enterprise Form Builder</p>'
        "</div>"
    )
    text = (
        f"Hi {name},\n\n"
        f'Your form "{form_title}" is live:\n{public_url}\n\n'
        "Enterprise Form Builder"
    )
    await _send(owner_email, subject, html, text)


async def send_password_changed_email(to_email: str, full_name: Optional[str]) -> None:
    name    = full_name or to_email
    subject = "Your password was changed"
    html = (
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">'
        '<h2 style="color:#dc2626;margin-bottom:4px">Password Changed</h2>'
        f'<p style="color:#374151">Hi {name},</p>'
        '<p style="color:#374151">Your password was successfully changed.'
        " If you did not do this, please contact support immediately.</p>"
        '<p style="color:#6b7280;font-size:13px;margin-top:32px">Enterprise Form Builder</p>'
        "</div>"
    )
    text = (
        f"Hi {name},\n\n"
        "Your password was changed. If you did not do this, contact support.\n\n"
        "Enterprise Form Builder"
    )
    await _send(to_email, subject, html, text)


async def send_email_otp(to_email: str, code: str) -> None:
    """Deprecated: Email OTPs are no longer used.
    Left as a no-op for backward compatibility.
    """
    return
async def send_password_reset_otp(to_email: str, code: str) -> None:
    """Deprecated: Password reset via server-side OTP is removed.
    Use Firebase client SDK's sendPasswordResetEmail().
    """
    return

