import sys
import os

# Add the backend path to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'Backend', 'sms-backend'))

from src.services.notification.email_service import EmailService

def test_outlook_email():
    print("🔧 Testing Outlook Email Configuration...")
    
    email_service = EmailService()
    
    # Replace with your actual email for testing
    test_email = "topfoundation@outlook.com" 
    
    print(f"📧 Sending test email to: {test_email}")
    print(f"📤 Using SMTP Server: {email_service.smtp_server}")
    print(f"📤 Using Port: {email_service.smtp_port}")
    print(f"📤 From Email: {email_service.sender_email}")
    
    result = email_service.send_email(
        test_email,
        "✅ Test Email from School Management System",
        """
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #2c3e50; text-align: center;">🎉 Email Test Successful!</h1>
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>✅ Congratulations!</strong> Your Outlook SMTP configuration is working correctly.</p>
                </div>
                <h3>Configuration Details:</h3>
                <ul>
                    <li><strong>SMTP Server:</strong> smtp-mail.outlook.com</li>
                    <li><strong>Port:</strong> 587</li>
                    <li><strong>TLS:</strong> Enabled</li>
                    <li><strong>From:</strong> topfoundation@outlook.com</li>
                </ul>
                <p>Your School Management System is now ready to send emails!</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">
                    This is an automated test message from your School Management System.
                </p>
            </div>
        </body>
        </html>
        """
    )
    
    if result:
        print("✅ Email sent successfully!")
        print("📬 Check your inbox (and spam folder) for the test email.")
    else:
        print("❌ Failed to send email. Check the error messages above.")
        print("\n🔍 Troubleshooting tips:")
        print("1. Verify your Outlook credentials")
        print("2. Check if 2FA is enabled (use App Password)")
        print("3. Ensure 'Less secure app access' is enabled")
        print("4. Check your internet connection")

if __name__ == "__main__":
    test_outlook_email()