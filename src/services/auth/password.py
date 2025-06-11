import random
import string

def generate_default_password(length=12):
    """Generate a secure random password
    
    Args:
        length (int): Length of the password, will be clamped between 8-12 characters
        
    Returns:
        str: A secure random password with at least one character from each required set
    """
    # Ensure length is between 8-12 characters
    length = max(8, min(12, length))
    
    # Define character sets
    uppercase_letters = string.ascii_uppercase
    lowercase_letters = string.ascii_lowercase
    digits = string.digits
    special_chars = "!@#$%^&*()_-+=<>?"
    
    # Ensure at least one character from each set
    password = [
        random.choice(uppercase_letters),
        random.choice(lowercase_letters),
        random.choice(digits),
        random.choice(special_chars)
    ]
    
    # Fill the rest with random characters from all sets
    all_chars = uppercase_letters + lowercase_letters + digits + special_chars
    password.extend(random.choice(all_chars) for _ in range(length - 4))
    
    # Shuffle the password characters
    random.shuffle(password)
    
    # Convert list to string and return
    return ''.join(password)