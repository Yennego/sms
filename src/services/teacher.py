from src.services.base import TenantBaseService
from src.db.models.teacher import Teacher
from src.db.crud.teacher import TeacherCRUD
from src.schemas.teacher import TeacherCreate, TeacherUpdate

class TeacherService(TenantBaseService[Teacher, TeacherCreate, TeacherUpdate]):
    def __init__(self, **kwargs):
        super().__init__(crud=TeacherCRUD(), model=Teacher, **kwargs) 