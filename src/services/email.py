from src.services.notification.email_service import EmailService

def send_new_user_email(user_email, first_name, password):
    """Send a welcome email to a new user with their login details"""
    email_service = EmailService()
    subject = "Welcome to the System"
    message = f"""
    <html>
    <body>
        <h2>Welcome, {first_name}!</h2>
        <p>Your account has been created. Here are your login details:</p>
        <p><strong>Email:</strong> {user_email}</p>
        <p><strong>Temporary Password:</strong> {password}</p>
        <p>Please log in and change your password immediately.</p>
        <p>This is an automated message, please do not reply.</p>
    </body>
    </html>
    """
    return email_service.send_email(user_email, subject, message)