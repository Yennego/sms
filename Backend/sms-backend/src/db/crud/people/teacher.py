from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from src.db.crud.base import TenantCRUDBase
from src.db.models.people import Teacher
from src.schemas.people.teacher import TeacherCreate, TeacherUpdate
from src.core.security.password import get_password_hash
import secrets
import string

# Add this function to generate random passwords
def generate_default_password(length=12):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

class CRUDTeacher(TenantCRUDBase[Teacher, TeacherCreate, TeacherUpdate]):
    """CRUD operations for Teacher model."""
    
    def get_by_employee_id(self, db: Session, tenant_id: Any, employee_id: str) -> Optional[Teacher]:
        """Get a teacher by employee ID within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.employee_id == employee_id
        ).first()
    
    def get_by_department(self, db: Session, tenant_id: Any, department: str) -> List[Teacher]:
        """Get teachers by department within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.department == department
        ).all()
    
    def get_class_teachers(self, db: Session, tenant_id: Any) -> List[Teacher]:
        """Get all class teachers within a tenant."""
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.is_class_teacher == True
        ).all()
    
    def generate_employee_id(self, db: Session, tenant_id: Any, prefix: str = "TCH", digits: int = 4) -> str:
        """Generate a unique employee ID for a teacher within a tenant."""
        # Get the highest existing employee ID with the same prefix
        latest_teacher = db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.employee_id.like(f"{prefix}%")
        ).order_by(Teacher.employee_id.desc()).first()
        
        if latest_teacher and latest_teacher.employee_id:
            try:
                # Extract number from latest ID (e.g., TCH0001 -> 1)
                number_part = latest_teacher.employee_id[len(prefix):]
                if number_part.isdigit():
                    next_num = int(number_part) + 1
                else:
                    next_num = 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        # Format with specified digits (e.g., TCH0001, TCH0002, etc.)
        return f"{prefix}{str(next_num).zfill(digits)}"
    
    def create(self, db: Session, *, tenant_id: Any, obj_in: Union[TeacherCreate, Dict[str, Any]]) -> Teacher:
        """Create a new teacher with auto-generated employee ID and password hashing."""
        if isinstance(obj_in, dict):
            create_data = obj_in.copy()
        else:
            create_data = obj_in.dict(exclude_unset=True)
        
        # Generate employee ID if not provided
        if not create_data.get('employee_id'):
            create_data['employee_id'] = self.generate_employee_id(db, tenant_id)
        
        # Handle password hashing
        password = create_data.get('password')
        if not password:  # Generate default password if not provided
            password = generate_default_password()
        
        # Convert password to password_hash
        create_data['password_hash'] = get_password_hash(password)
        if 'password' in create_data:
            del create_data['password']  # Remove plain password
        
        # Set first login flag
        create_data['is_first_login'] = True
        
        return super().create(db=db, tenant_id=tenant_id, obj_in=create_data)
    
    def search_teachers(self, db: Session, tenant_id: Any, search_term: str, skip: int = 0, limit: int = 100) -> List[Teacher]:
        """Search teachers by name, email, or employee_id within a tenant."""
        search_pattern = f"%{search_term}%"
        return db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            or_(
                Teacher.first_name.ilike(search_pattern),
                Teacher.last_name.ilike(search_pattern),
                Teacher.email.ilike(search_pattern),
                Teacher.employee_id.ilike(search_pattern),
                func.concat(Teacher.first_name, ' ', Teacher.last_name).ilike(search_pattern)
            )
        ).offset(skip).limit(limit).all()
    
    def list_with_search(self, db: Session, tenant_id: Any, skip: int = 0, limit: int = 100, search: Optional[str] = None, **filters) -> List[Teacher]:
        """List teachers with optional search and filters."""
        query = db.query(Teacher).filter(Teacher.tenant_id == tenant_id)
        
        # Apply search if provided
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Teacher.first_name.ilike(search_pattern),
                    Teacher.last_name.ilike(search_pattern),
                    Teacher.email.ilike(search_pattern),
                    Teacher.employee_id.ilike(search_pattern),
                    func.concat(Teacher.first_name, ' ', Teacher.last_name).ilike(search_pattern)
                )
            )
        
        # Apply other filters
        for field, value in filters.items():
            if hasattr(Teacher, field) and value is not None:
                query = query.filter(getattr(Teacher, field) == value)
        
        # Add default ordering
        if hasattr(Teacher, 'created_at'):
            query = query.order_by(Teacher.created_at.asc())
        elif hasattr(Teacher, 'id'):
            query = query.order_by(Teacher.id.asc())
        
        return query.offset(skip).limit(limit).all()


teacher = CRUDTeacher(Teacher)

