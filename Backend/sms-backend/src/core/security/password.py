import secrets
import string
import time
from passlib.context import CryptContext

# Alternative: Use Argon2 for better performance
password_context = CryptContext(
    schemes=["argon2", "bcrypt"], 
    deprecated="auto",
    argon2__memory_cost=65536,  # 64 MB
    argon2__time_cost=3,        # 3 iterations
    argon2__parallelism=1       # 1 thread
)

# Add this function to check bcrypt version
def check_bcrypt_version():
    import bcrypt
    try:
        version = bcrypt.__version__
        print(f"Using bcrypt version: {version}")
    except AttributeError:
        print("Could not determine bcrypt version")
        # Try to use bcrypt anyway
        test_hash = bcrypt.hashpw(b"test", bcrypt.gensalt())
        print(f"Test hash generated: {test_hash is not None}")

# Call this function during startup
check_bcrypt_version()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    try:
        start_time = time.time()
        result = password_context.verify(plain_password, hashed_password)
        end_time = time.time()
        print(f"Password verification took {end_time - start_time:.2f} seconds")
        return result
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generate a bcrypt password hash."""
    return password_context.hash(password)

# Specials that are easy to read aloud and type on a phone keyboard
SPECIAL_CHARS = "!@#$%&*?"

_rng = secrets.SystemRandom()


def generate_default_password(length=12):
    """Generate a random password that satisfies the password policy.

    Used for admin-issued passwords (new accounts, resets); the user must change it
    at first login.

    Args:
        length (int): Length of the password, clamped between 10 and 16 characters

    Returns:
        str: A password with at least one uppercase, lowercase, digit and special character
    """
    length = max(10, min(16, length))
    sets = [string.ascii_uppercase, string.ascii_lowercase, string.digits, SPECIAL_CHARS]
    password = [_rng.choice(chars) for chars in sets]
    all_chars = "".join(sets)
    password.extend(_rng.choice(all_chars) for _ in range(length - len(sets)))
    _rng.shuffle(password)
    return "".join(password)
