"""Reset a super-admin's password from the server (there is no email reset for platform accounts).

Run from Backend/sms-backend on the server, with the API's environment (.env) in place:

    python -m scripts.reset_super_admin_password admin@example.com            # generates a password
    python -m scripts.reset_super_admin_password admin@example.com --prompt   # type one instead

A generated password is printed once; the account must change it at next sign-in. Only accounts
holding the built-in super-admin role can be reset this way.
"""
import argparse
import getpass
import sys

import src.db.models  # noqa: F401  registers every model
from src.core.security.password import generate_default_password, get_password_hash
from src.core.security.password_policy import PasswordPolicy
from src.db.crud.auth.user import user as user_crud
from src.db.session import platform_session


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a super-admin's password")
    parser.add_argument("email")
    parser.add_argument("--prompt", action="store_true", help="type the new password instead of generating one")
    args = parser.parse_args()

    db = platform_session()
    try:
        user = user_crud.get_super_admin_by_email(db, email=args.email)
        if not user:
            print(f"No super-admin account with email {args.email}", file=sys.stderr)
            return 1

        if args.prompt:
            password = getpass.getpass("New password: ")
            if password != getpass.getpass("Confirm new password: "):
                print("The passwords don't match", file=sys.stderr)
                return 1
            errors = PasswordPolicy().validate(password)
            if errors:
                print("; ".join(errors), file=sys.stderr)
                return 1
        else:
            password = generate_default_password()

        user.password_hash = get_password_hash(password)
        user.is_first_login = True  # must choose their own password at next sign-in
        user.is_active = True
        db.commit()
    finally:
        db.close()

    print(f"Password reset for {args.email}. They'll be asked to change it at next sign-in.")
    if not args.prompt:
        print(f"Temporary password (shown once): {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
