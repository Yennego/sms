import uuid
from typing import Any
from sqlalchemy import UUID
from sqlalchemy.orm import Mapped, mapped_column

class UUIDMixin:
    """Mixin that adds a UUID primary key column to a model.
    
    This mixin automatically generates a UUID primary key for a model if one is not provided.
    The UUID is stored in the 'id' column.
    """
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )