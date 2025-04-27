from src.services.base import TenantBaseService
from src.db.models.class_room import ClassRoom
from src.db.crud.class_room import ClassRoomCRUD
from src.schemas.class_room import ClassRoomCreate, ClassRoomUpdate

class ClassRoomService(TenantBaseService[ClassRoom, ClassRoomCreate, ClassRoomUpdate]):
    def __init__(self, **kwargs):
        super().__init__(crud=ClassRoomCRUD(), model=ClassRoom, **kwargs) 