import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'Backend', 'sms-backend'))

from src.services.email import send_new_user_email

def test_user_registration_email():
    print("🧪 Testing User Registration Email...")
    
    # Test the actual function used in user creation
    result = send_new_user_email(
        user_email="topfoundation@outlook.com",  # ⚠️ CHANGE THIS
        first_name="Tomorrow's People",
        password="Top-Found@2025"
    )
    
    if result:
        print("✅ User registration email sent successfully!")
    else:
        print("❌ Failed to send user registration email.")

if __name__ == "__main__":
    test_user_registration_email()