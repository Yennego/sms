from src.db.crud.user import user
from src.db.crud.student import student
from src.db.crud.teacher import teacher
from src.db.crud.class_room import class_room

# Export all CRUD instances for easy importing
__all__ = ["user", "student", "teacher", "class_room"]