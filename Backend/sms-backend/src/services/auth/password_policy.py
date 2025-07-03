import re
from src.core.config import settings

class PasswordPolicy:
    def __init__(self):
        self.min_length = settings.PASSWORD_MIN_LENGTH
        self.require_uppercase = settings.PASSWORD_REQUIRE_UPPERCASE
        self.require_lowercase = settings.PASSWORD_REQUIRE_LOWERCASE
        self.require_numbers = settings.PASSWORD_REQUIRE_NUMBERS
        self.require_special = settings.PASSWORD_REQUIRE_SPECIAL
        self.max_age_days = settings.PASSWORD_MAX_AGE_DAYS
    
    def validate(self, password):
        """Validate a password against the policy"""
        errors = []
        
        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long")
        
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
            
        if self.require_lowercase and not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
            
        if self.require_numbers and not re.search(r'[0-9]', password):
            errors.append("Password must contain at least one number")
            
        if self.require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character")
            
        return errors

