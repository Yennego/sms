import pywhatkit as kit
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from src.db.models.tenant.notification_config import TenantNotificationConfig
from src.db.models.tenant.tenant import Tenant
from src.core.config import settings

class MultiTenantWhatsAppService:
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.config = self._get_tenant_config()
        self.tenant = self._get_tenant_info()
    
    def _get_tenant_config(self) -> Optional[TenantNotificationConfig]:
        """Get tenant-specific WhatsApp configuration"""
        return self.db.query(TenantNotificationConfig).filter(
            TenantNotificationConfig.tenant_id == self.tenant_id
        ).first()
    
    def _get_tenant_info(self) -> Optional[Tenant]:
        """Get tenant information including domain"""
        return self.db.query(Tenant).filter(
            Tenant.id == self.tenant_id
        ).first()
    
    def _get_login_url(self) -> str:
        """Get the login URL for the tenant"""
        if self.tenant and self.tenant.domain:
            return f"https://{self.tenant.domain}/login"
        elif self.tenant and self.tenant.subdomain:
            return f"https://{self.tenant.subdomain}.yourdomain.com/login"
        else:
            # Fallback to localhost or default domain
            return "http://localhost:3000/login"
    
    def send_teacher_credentials(self, phone_number: str, teacher_data: Dict[str, Any]) -> bool:
        """Send teacher credentials via WhatsApp"""
        if not self._is_enabled():
            return False
        
        try:
            # Get tenant info for school name and login URL
            tenant_info = self._get_tenant_info()
            school_name = tenant_info.name if tenant_info else "School"
            login_url = self._get_login_url()
            
            # Prepare template data with proper formatting
            template_data = {
                'teacher_name': f"{teacher_data.get('first_name', '')} {teacher_data.get('last_name', '')}".strip(),
                'school_name': school_name,
                'employee_id': teacher_data.get('employee_id', 'N/A'),
                'email': teacher_data.get('email', 'N/A'),
                'password': teacher_data.get('password', 'N/A'),
                'login_url': login_url
            }
            
            # Get template and format message
            template = self.config.teacher_message_template or self._get_default_teacher_template()
            message = self._format_message(template, template_data)
            
            # Format phone number and send
            formatted_phone = self._format_phone_number(phone_number)
            return self._send_message(formatted_phone, message)
            
        except Exception as e:
            print(f"Error sending teacher credentials: {e}")
            return False
        
        if not self._is_enabled() or not phone_number:
            return False
        
        template = self.config.teacher_welcome_template or self._get_default_teacher_template()
        message = self._format_message(template, {
            'teacher_name': f"{teacher_data['first_name']} {teacher_data['last_name']}",
            'email': teacher_data['email'],
            'password': teacher_data['password'],
            'school_name': self.config.school_name,
            'employee_id': teacher_data.get('employee_id', 'N/A'),
            'login_url': self._get_login_url()
        })
        
        success = self._send_message(phone_number, message)
        
        if success and self.config.notify_admin_on_user_creation:
            self._notify_admin(f"✅ Teacher {teacher_data['first_name']} {teacher_data['last_name']} created and notified via WhatsApp")
        
        return success
    
    def send_student_credentials(self, phone_number: str, student_data: Dict[str, Any]) -> bool:
        """Send student login credentials via WhatsApp"""
        if not self._is_enabled() or not phone_number:
            return False
        
        template = self.config.student_welcome_template or self._get_default_student_template()
        message = self._format_message(template, {
            'student_name': f"{student_data['first_name']} {student_data['last_name']}",
            'email': student_data['email'],
            'password': student_data['password'],
            'school_name': self.config.school_name,
            'student_id': student_data.get('student_id', 'N/A'),
            'grade': student_data.get('grade', 'N/A')
        })
        
        success = self._send_message(phone_number, message)
        
        if success and self.config.notify_admin_on_user_creation:
            self._notify_admin(f"✅ Student {student_data['first_name']} {student_data['last_name']} created and notified via WhatsApp")
        
        return success
    
    def send_parent_credentials(self, phone_number: str, parent_data: Dict[str, Any], student_data: Dict[str, Any]) -> bool:
        """Send parent login credentials via WhatsApp"""
        if not self._is_enabled() or not phone_number:
            return False
        
        template = self.config.parent_welcome_template or self._get_default_parent_template()
        message = self._format_message(template, {
            'parent_name': f"{parent_data['first_name']} {parent_data['last_name']}",
            'student_name': f"{student_data['first_name']} {student_data['last_name']}",
            'email': parent_data['email'],
            'password': parent_data['password'],
            'school_name': self.config.school_name,
            'student_id': student_data.get('student_id', 'N/A')
        })
        
        success = self._send_message(phone_number, message)
        
        if success and self.config.notify_admin_on_user_creation:
            self._notify_admin(f"✅ Parent {parent_data['first_name']} {parent_data['last_name']} created and notified via WhatsApp")
        
        return success
    
    def notify_parent_about_student(self, parent_phone: str, student_data: Dict[str, Any], message_type: str = "enrollment") -> bool:
        """Notify parent about student enrollment/updates"""
        if not self._is_enabled() or not parent_phone:
            return False
        
        if message_type == "enrollment":
            message = f"""
🎓 {self.config.school_name}

👋 Dear Parent,

Your child {student_data['first_name']} {student_data['last_name']} has been successfully enrolled!

📚 Student ID: {student_data.get('student_id', 'N/A')}
🏫 Grade: {student_data.get('grade', 'N/A')}
📧 Student Email: {student_data['email']}

You will receive separate login credentials for the parent portal.

Welcome to our school family! 🎉
            """.strip()
        
        return self._send_message(parent_phone, message)
    
    def _send_message(self, phone_number: str, message: str) -> bool:
        """Send WhatsApp message immediately"""
        try:
            formatted_number = self._format_phone_number(phone_number)
            
            # Send message immediately
            kit.sendwhatmsg_instantly(
                phone_no=formatted_number,
                message=message,
                wait_time=15,
                tab_close=True
            )
            return True
        except Exception as e:
            print(f"WhatsApp sending failed: {e}")
            return False
    
    def _notify_admin(self, message: str) -> bool:
        """Send notification to tenant admin"""
        if not self.config.admin_whatsapp_number:
            return False
        
        admin_message = f"🔔 {self.config.school_name} - Admin Notification:\n\n{message}"
        return self._send_message(self.config.admin_whatsapp_number, admin_message)
    
    def _is_enabled(self) -> bool:
        """Check if WhatsApp is enabled for this tenant"""
        return self.config and self.config.whatsapp_enabled
    
    def _format_phone_number(self, phone: str) -> str:
        """Format phone number with country code"""
        clean_phone = ''.join(filter(str.isdigit, phone))
        if not clean_phone.startswith('1') and len(clean_phone) == 10:
            clean_phone = '1' + clean_phone
        return '+' + clean_phone
    
    def _format_message(self, template: str, data: Dict[str, Any]) -> str:
        """Format message template with data"""
        try:
            formatted_message = template.format(**data)
            print(f"Formatted message: {formatted_message[:100]}...")  # Debug log
            return formatted_message
        except KeyError as e:
            print(f"Template formatting error - missing key: {e}")
            print(f"Available keys: {list(data.keys())}")
            print(f"Template: {template[:200]}...")
            # Return a fallback message instead of the template
            return f"Welcome! Your account has been created. Please contact admin for login details."
        except Exception as e:
            print(f"Unexpected template formatting error: {e}")
            return f"Welcome! Your account has been created. Please contact admin for login details."
    
    def _get_default_teacher_template(self) -> str:
        return """
🏫 Welcome to {school_name}!

👋 Hello {teacher_name},

Your teacher account has been successfully created! Here are your login details:

👤 Full Name: {teacher_name}
🆔 Employee ID: {employee_id}
📧 Email: {email}
🔐 Password: {password}

⚠️ Please change your password after first login for security.

🌐 Login URL: {login_url}

Welcome to the team! 🎉
        """.strip()
    
    def _get_default_student_template(self) -> str:
        return """
🎓 Welcome to {school_name}!

👋 Hello {student_name},

Your student account has been successfully created! Here are your login details:

👤 Full Name: {student_name}
🆔 Student ID: {student_id}
📚 Grade: {grade}
📧 Email: {email}
🔐 Password: {password}

⚠️ Please change your password after first login for security.

🌐 Login URL: {login_url}

Welcome to our school! 📚
        """.strip()
    
    def _get_default_parent_template(self) -> str:
        return """
👨‍👩‍👧‍👦 {school_name} - Parent Portal

👋 Hello {parent_name},

Your parent account has been successfully created to monitor {student_name}'s progress:

👤 Full Name: {parent_name}
📧 Email: {email}
🔐 Password: {password}
👤 Student ID: {student_id}

⚠️ Please change your password after first login for security.

🌐 Login URL: {login_url}

Stay connected with your child's education! 📚
        """.strip()