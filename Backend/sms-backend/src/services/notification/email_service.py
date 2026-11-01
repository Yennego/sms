import html
import logging

from src.services.notification.senders import OutgoingMessage, SmtpEmailSender

logger = logging.getLogger(__name__)


class EmailService:
    """Account emails (welcome, generated password, password reset), sent straight away over the
    same SMTP sender as the alert worker (senders.SmtpEmailSender)."""

    def __init__(self):
        self.sender = SmtpEmailSender()

    def send_email(self, recipient_email, subject, message_html):
        """Send an email to a recipient. Returns True when the server accepted it."""
        result = self.sender.send(OutgoingMessage(to=recipient_email, subject=subject,
                                                  text="Please open this email in an HTML-capable mail app.",
                                                  html=message_html))
        if result.status != "sent":
            logger.warning("Email not sent (%s): %s", result.status, result.error)
        return result.status == "sent"

    def is_configured(self) -> bool:
        """True when an SMTP server and sender account are set."""
        return self.sender.configured()

    def send_password_reset_link(self, user_email, reset_link, school_name, expires_minutes):
        """Email a single-use password reset link."""
        school = html.escape(school_name or "your school")
        link = html.escape(reset_link, quote=True)
        subject = f"Reset your password - {school_name or 'School Management System'}"
        message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Reset your password
                </h2>
                <p>Someone asked to reset the password for your {school} account.</p>
                <p style="margin: 24px 0;">
                    <a href="{link}" style="background-color: #4f46e5; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
                        Choose a new password
                    </a>
                </p>
                <p>The link works once and expires in {int(expires_minutes)} minutes.</p>
                <p>If you didn't ask for this, you can ignore this email: your password stays the same.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #666;">
                    This is an automated message, please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        """
        return self.send_email(user_email, subject, message)

    def send_password_notification(self, user_email, generated_password):
        """Send a notification with the generated password"""
        subject = "Your New Account Information - School Management System"
        message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Welcome to School Management System
                </h2>
                <p>Your account has been created successfully. Here are your login details:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Email:</strong> {user_email}</p>
                    <p><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{generated_password}</code></p>
                </div>
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>⚠️ Important:</strong> Please log in and change your password immediately for security reasons.</p>
                </div>
                <p>If you have any questions, please contact your system administrator.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #666;">
                    This is an automated message, please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        """
        return self.send_email(user_email, subject, message)

