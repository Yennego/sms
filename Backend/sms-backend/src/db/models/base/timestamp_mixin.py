from typing import Any
from datetime import datetime, UTC
from sqlalchemy import Column, DateTime
from sqlalchemy.orm import Mapped, mapped_column

class TimestampMixin:
    """Mixin that adds created_at and updated_at timestamps to a model.
    
    This mixin provides automatic timestamp tracking for model instances.
    The created_at field is set when the instance is first created,
    and updated_at is set whenever the instance is modified.
    
    Attributes:
        created_at (datetime): When the record was created
        updated_at (datetime): When the record was last updated
    """
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False
    )
    
    def __init__(self, **kwargs):
        now = datetime.now(UTC)
        if 'created_at' not in kwargs:
            kwargs['created_at'] = now
        if 'updated_at' not in kwargs:
            kwargs['updated_at'] = now
            
        for key, value in kwargs.items():
            setattr(self, key, value) 

            