"""A school's address is its slug (/{slug}/...): rules for the slug (the tenant's domain/subdomain).

The first path segments below are never a school. Keep this list the same as the frontend's
src/config/reserved-slugs.ts.
"""
import re
from typing import Optional

RESERVED_SLUGS = frozenset({
    # Platform and framework paths
    "api", "_next", "static", "public", "favicon.ico", "assets", "www",
    "platform", "super-admin", "admin-dashboard",
    # Sign-in and account pages that also exist outside a school
    "login", "logout", "register", "session-expired", "forgot-password", "reset-password",
    "change-password", "profile",
    # Public report card check (/verify/{code}, phase4-design.md §7)
    "verify",
    # Area names (today's and the remodel's), so /{area} is never mistaken for a school
    "dashboard", "home", "academics", "admin", "students", "student", "teachers", "teacher", "staff",
    "parents", "parent", "classes", "attendance", "scan", "grades", "gradebook", "results", "exams",
    "assignments", "timetable", "timetables", "finance", "fees", "communication", "messages",
    "resources", "logging", "settings", "users", "schools", "audit", "reports",
})

# Lowercase letters, digits and single hyphens between them: "top-foundation", "school2"
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MAX_LENGTH = 63


def slug_problem(value: str) -> Optional[str]:
    """Why this can't be a school's slug, or None when it's fine."""
    if len(value) > SLUG_MAX_LENGTH:
        return f"must be at most {SLUG_MAX_LENGTH} characters"
    if not SLUG_PATTERN.match(value):
        hint = f" (e.g. '{value.lower()}')" if SLUG_PATTERN.match(value.lower()) else ""
        return ("may only contain lowercase letters, digits and hyphens, "
                "and can't start or end with a hyphen" + hint)
    if value in RESERVED_SLUGS:
        return f"'{value}' is reserved by the app; choose another"
    return None


def normalize_slug(value: Optional[str]) -> Optional[str]:
    """Blank means none; surrounding spaces are ignored. Addresses are always lower case:
    'Foundation' is stored as 'foundation'."""
    if value is None:
        return None
    value = value.strip().lower()
    return value or None


def validate_slug(value: Optional[str], field: str = "domain") -> Optional[str]:
    """Normalized slug, or ValueError with a message naming the field."""
    value = normalize_slug(value)
    if value is None:
        return None
    problem = slug_problem(value)
    if problem:
        raise ValueError(f"School {field} {problem}")
    return value
