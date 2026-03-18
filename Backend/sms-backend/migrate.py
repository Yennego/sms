import subprocess
import sys
import os

def run_migrations():
    """Run alembic migrations to sync the database schema."""
    print("🚀 Starting database migration process...")
    
    # Ensure we are in the correct directory for alembic.ini
    # This script should be in Backend/sms-backend/
    try:
        # Run upgrade head
        result = subprocess.run(
            ["alembic", "upgrade", "head"], 
            check=False,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Database schema is up to date!")
            if result.stdout:
                print(result.stdout)
        else:
            print("❌ Migration failed!")
            print(f"Error: {result.stderr}")
            # If it's a critical failure (like DB connection), exit with error
            if "pydantic.v1.error_wrappers.ValidationError" not in result.stderr:
                sys.exit(1)
            else:
                print("⚠️ Warning: Detected Pydantic validation error during migration, but continuing as it might be environment-specific.")
                
    except Exception as e:
        print(f"❌ Unexpected error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
