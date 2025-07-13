import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.core.config import settings
import ssl

class EmailService:
    def __init__(self):
        # For development, you can use your own email or a local SMTP server
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.sender_email = settings.SENDER_EMAIL
        self.sender_password = settings.SENDER_PASSWORD
    
    def send_email(self, recipient_email, subject, message_html):
        """Send an email to a recipient"""
        try:
            # Create message container
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.sender_email
            msg['To'] = recipient_email
            
            # Create HTML message
            html_part = MIMEText(message_html, 'html')
            msg.attach(html_part)
            
            # Create SSL context for better security
            context = ssl.create_default_context()
            
            # Connect to server and send
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)  # Secure the connection with SSL context
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)
                
            print(f"Email sent successfully to {recipient_email}")
            return True
        except smtplib.SMTPAuthenticationError as e:
            print(f"SMTP Authentication failed: {str(e)}")
            print("Please check your email credentials or enable 2FA and use App Password")
            return False
        except smtplib.SMTPException as e:
            print(f"SMTP error occurred: {str(e)}")
            return False
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            return False
    
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

