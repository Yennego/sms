from typing import Any, ClassVar
from sqlalchemy.orm import declared_attr
from .uuid_mixin import UUIDMixin
from .timestamp_mixin import TimestampMixin
from .tenant_mixin import TenantMixin
# Import Base from the current package
from . import Base

class TenantModel(UUIDMixin, TimestampMixin, TenantMixin, Base):
    """Base model for all tenant-aware models in the system.
    
    This model combines UUIDMixin, TimestampMixin, and TenantMixin to provide:
    - UUID primary keys
    - Created/updated timestamps
    - Tenant isolation via tenant_id foreign key
    - Automatic table naming
    
    All tenant-aware models should inherit from this class.
    
    Usage:
        class MyModel(TenantModel):
            __tablename__ = "my_model"
            ...
    """
    
    __abstract__ = True
    __allow_unmapped__ = True
    
    @declared_attr.directive
    @classmethod
    def __tablename__(cls) -> str:
        """Generate table name from class name.
        
        Returns:
            str: The table name in plural snake_case format.
        """
        # Convert camel case to snake case and pluralize
        name = cls.__name__
        # Insert underscore between lowercase and uppercase letters
        name = ''.join(['_' + c.lower() if c.isupper() else c for c in name]).lstrip('_')
        # Pluralize by adding 's'
        return name + 's'
    
    def __init__(self, **kwargs: Any) -> None:
        """Initialize the model with validation.
        
        Args:
            **kwargs: Attributes to set on the model.
            
        Raises:
            ValueError: If required fields are missing or invalid.
        """
        super().__init__(**kwargs)
    
    def __repr__(self) -> str:
        """Get string representation of the model.
        
        Returns:
            str: String representation including class name and id.
        """
        return f"{self.__class__.__name__}(id={self.id})"

        