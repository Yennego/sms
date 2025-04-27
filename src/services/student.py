from src.services.base import TenantBaseService
from src.db.models.student import Student
from src.db.crud.student import StudentCRUD
from src.schemas.student import StudentCreate, StudentUpdate

class StudentService(TenantBaseService[Student, StudentCreate, StudentUpdate]):
    def __init__(self, **kwargs):
        super().__init__(crud=StudentCRUD(), model=Student, **kwargs) 