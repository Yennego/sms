"""Message senders for the delivery worker (phase6-design.md §1 "Channels", "Email").

A sender takes one message and says what happened: sent (with the provider's reference), failed
(with the error; the worker retries) or skipped (the channel isn't set up; never retried).
"""
import html
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SendResult:
    status: str  # sent | failed | skipped
    provider_ref: Optional[str] = None
    error: Optional[str] = None


@dataclass
class OutgoingMessage:
    to: str
    subject: str
    text: str
    html: Optional[str] = None


class MessageSender:
    channel = ""

    def configured(self) -> bool:
        raise NotImplementedError

    def send(self, message: OutgoingMessage) -> SendResult:
        raise NotImplementedError


class SmtpEmailSender(MessageSender):
    """Plain SMTP, so any provider works (Brevo, Gmail, Outlook...). Off while SMTP_SERVER,
    SENDER_EMAIL or SENDER_PASSWORD is empty."""

    channel = "email"

    def __init__(self, server: Optional[str] = None, port: Optional[int] = None, sender: Optional[str] = None,
                 password: Optional[str] = None, use_tls: Optional[bool] = None, from_name: Optional[str] = None,
                 timeout: int = 20):
        self.server = settings.SMTP_SERVER if server is None else server
        self.port = settings.SMTP_PORT if port is None else port
        self.sender = settings.SENDER_EMAIL if sender is None else sender
        self.password = settings.SENDER_PASSWORD if password is None else password
        self.use_tls = settings.SMTP_USE_TLS if use_tls is None else use_tls
        self.from_name = settings.EMAIL_FROM_NAME if from_name is None else from_name
        self.timeout = timeout

    def configured(self) -> bool:
        return bool(self.server and self.sender and self.password)

    def _connect(self):
        context = ssl.create_default_context()
        if int(self.port) == 465:
            return smtplib.SMTP_SSL(self.server, self.port, context=context, timeout=self.timeout)
        server = smtplib.SMTP(self.server, self.port, timeout=self.timeout)
        if self.use_tls:
            server.starttls(context=context)
        return server

    def send(self, message: OutgoingMessage) -> SendResult:
        if not self.configured():
            return SendResult("skipped", error="Email is not set up (SMTP_SERVER, SENDER_EMAIL, SENDER_PASSWORD)")
        msg = EmailMessage()
        msg["Subject"] = message.subject
        msg["From"] = formataddr((self.from_name, self.sender)) if self.from_name else self.sender
        msg["To"] = message.to
        msg["Message-ID"] = make_msgid(domain=self.sender.split("@")[-1] or None)
        msg.set_content(message.text)
        if message.html:
            msg.add_alternative(message.html, subtype="html")
        try:
            with self._connect() as server:
                server.login(self.sender, self.password)
                server.send_message(msg)
        except (smtplib.SMTPException, OSError) as exc:
            # The recipient's address can be in the error; it is the school's own data, kept in its log
            return SendResult("failed", error=f"{type(exc).__name__}: {exc}"[:1000])
        return SendResult("sent", provider_ref=msg["Message-ID"])


class SmsStubSender(MessageSender):
    """SMS is on hold (phase6-design.md §1): deliveries are created only for schools with
    enable_sms_notifications on, and this stub logs them as skipped."""

    channel = "sms"

    def configured(self) -> bool:
        return False

    def send(self, message: OutgoingMessage) -> SendResult:
        return SendResult("skipped", error="SMS is not available yet")


def alert_email(title: str, body: str, link: Optional[str], school_name: Optional[str]) -> OutgoingMessage:
    """An alert's email: the inbox text and a link to the app, nothing more (§2)."""
    url = f"{settings.APP_BASE_URL}{link}" if link else settings.APP_BASE_URL
    school = school_name or "School Management System"
    text = f"{body}\n\nOpen the app: {url}\n\n{school}\nThis is an automated message; please don't reply."
    page = f"""<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
<div style="max-width: 560px; margin: 0 auto; padding: 16px;">
<h3 style="margin: 0 0 12px;">{html.escape(title)}</h3>
<p>{html.escape(body)}</p>
<p><a href="{html.escape(url, quote=True)}">Open the app</a></p>
<p style="font-size: 12px; color: #666;">{html.escape(school)}. This is an automated message; please don't reply.</p>
</div></body></html>"""
    return OutgoingMessage(to="", subject=f"{title} - {school}", text=text, html=page)
