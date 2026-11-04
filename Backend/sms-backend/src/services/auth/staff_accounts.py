"""School staff accounts made by the school itself (the Users page, "Add staff member").

An admin with manage_users gives a person a sign-in with one staff role: a built-in role or one of
the school's custom roles, never a platform, student or parent role. Teachers are added under
Staff, which also keeps their teacher record. The password is generated like an admission's,
returned once to hand over, and must be changed at first sign-in. Only the platform operator creates
an admin account. Staged in the request's unit of work (flush, no commit).
"""
import re
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.core.security.password import generate_default_password, get_password_hash
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole
from src.db.models.auth.username import username_problem

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Roles a school can't hand out here: the platform's, families', and teachers (added under Staff)
NOT_STAFF_ROLES = {"super-admin", "superadmin", "super_admin", "student", "parent", "teacher"}
# Accounts with one of these roles are created only by the platform operator
SCHOOL_ADMIN_ROLES = {"admin", "tenant-admin"}


def _blank(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class StaffAccountService:
    def __init__(self, db: Session, tenant_id: UUID, actor_may_create_admin: bool):
        self.db = db
        self.tenant_id = tenant_id
        self.actor_may_create_admin = actor_may_create_admin

    def roles(self) -> List[UserRole]:
        """Staff roles this person may give: built-in ones plus the school's own, admin only for the operator."""
        rows = self.db.query(UserRole).filter(
            or_(UserRole.tenant_id.is_(None), UserRole.tenant_id == self.tenant_id)
        ).order_by(UserRole.tenant_id.isnot(None), UserRole.name).all()
        return [r for r in rows if r.name not in NOT_STAFF_ROLES
                and (self.actor_may_create_admin or r.name not in SCHOOL_ADMIN_ROLES)]

    def _role(self, role_id: UUID) -> UserRole:
        role = self.db.query(UserRole).filter(
            UserRole.id == role_id, or_(UserRole.tenant_id.is_(None), UserRole.tenant_id == self.tenant_id)
        ).first()
        if role is None or role.name in ("super-admin", "superadmin", "super_admin"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        if role.name == "teacher":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Add teachers under Staff, then Add teacher, so they get a teacher record.")
        if role.name in NOT_STAFF_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Students and parents get their accounts through admission. Choose a staff role.")
        if role.name in SCHOOL_ADMIN_ROLES and not self.actor_may_create_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Only the platform operator creates admin accounts. Choose another role, or ask them.")
        return role

    def _taken(self, column, value: Optional[str]) -> bool:
        if not value:
            return False
        return self.db.query(User.id).filter(
            User.tenant_id == self.tenant_id, func.lower(column) == value.lower()
        ).first() is not None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        role = self._role(data["role_id"])
        first_name, last_name = _blank(data.get("first_name")), _blank(data.get("last_name"))
        if not first_name or not last_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter the first and last name.")
        email = _blank(data.get("email"))
        username = _blank(data.get("username"))
        username = username.lower() if username else None
        if email and not EMAIL_PATTERN.match(email):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="Enter an email like name@example.com, or leave it empty.")
        if username and username_problem(username):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"The username {username_problem(username)}.")
        if self._taken(User.email, email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="This email is already used in this school. Use another, or leave it empty.")
        if self._taken(User.username, username):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="This username is already used in this school. Choose another, or leave it empty.")

        # Generated like an admission's password (AdmissionService._new_password)
        password = generate_default_password()
        user = User(
            tenant_id=self.tenant_id, first_name=first_name, last_name=last_name, email=email, username=username,
            phone_number=_blank(data.get("phone_number")), password_hash=get_password_hash(password),
            is_first_login=True, is_active=True,
        )
        user.roles.append(role)
        self.db.add(user)
        self.db.flush()  # fills in the username when none was given
        name = f"{first_name} {last_name}"
        return {
            "id": user.id, "name": name, "username": user.username, "email": user.email, "role": role.name,
            "credentials": [{"who": role.name.replace("-", " "), "name": name, "username": user.username,
                             "password": password}],
        }
