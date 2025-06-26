# from tyoing import Optional

def calculate_password_strength(password: str) -> float:
    """
    Calculate the strength of a password on a scale of 0.0 to 1.0.
    
    A higher score indicates a stronger password.
    
    Factors considered:
    - Length
    - Presence of uppercase letters
    - Presence of lowercase letters
    - Presence of numbers
    - Presence of special characters
    """
    score = 0.0
    
    # Check length (up to 5 points)
    length = len(password)
    if length >= 12:
        score += 0.25
    elif length >= 8:
        score += 0.15
    elif length >= 6:
        score += 0.05
    
    # Check for uppercase letters (up to 0.25 points)
    if any(c.isupper() for c in password):
        score += 0.25
    
    # Check for lowercase letters (up to 0.25 points)
    if any(c.islower() for c in password):
        score += 0.25
    
    # Check for numbers (up to 0.25 points)
    if any(c.isdigit() for c in password):
        score += 0.25
    
    # Check for special characters (up to 0.25 points)
    special_chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\\'
    if any(c in special_chars for c in password):
        score += 0.25
    
    # Ensure score is between 0 and 1
    return min(max(score, 0.0), 1.0)
