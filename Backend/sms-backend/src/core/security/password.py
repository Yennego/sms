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