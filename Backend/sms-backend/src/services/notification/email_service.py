import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.core.config import settings

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
            
            # Connect to server and send
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # Secure the connection
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)
                
            return True
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            return False
    
    def send_password_notification(self, user_email, generated_password):
        """Send a notification with the generated password"""
        subject = "Your New Account Information"
        message = f"""
        <html>
        <body>
            <h2>Welcome to the System</h2>
            <p>Your account has been created. Here are your login details:</p>
            <p><strong>Email:</strong> {user_email}</p>
            <p><strong>Temporary Password:</strong> {generated_password}</p>
            <p>Please log in and change your password immediately.</p>
            <p>This is an automated message, please do not reply.</p>
        </body>
        </html>
        """
        return self.send_email(user_email, subject, message)

