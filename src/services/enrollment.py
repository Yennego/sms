from src.services.base import TenantBaseService
from src.db.models.enrollment import Enrollment
from src.db.crud.enrollment import EnrollmentCRUD
from src.schemas.enrollment import EnrollmentCreate, EnrollmentUpdate

class EnrollmentService(TenantBaseService[Enrollment, EnrollmentCreate, EnrollmentUpdate]):
    def __init__(self, **kwargs):
        super().__init__(crud=EnrollmentCRUD(), model=Enrollment, **kwargs) 