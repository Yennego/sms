from passlib.context import CryptContext


# Create password context using bcrypt
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
        return password_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generate a bcrypt password hash."""
    return password_context.hash(password)