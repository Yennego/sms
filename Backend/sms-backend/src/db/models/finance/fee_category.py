from sqlalchemy import Boolean, Column, String, Text, text
from src.db.models.base import TenantModel


class FeeCategory(TenantModel):
    """A type of fee (Tuition, Transport, Library...). A category used by a schedule or an invoice
    line can't be deleted; switch it off with is_active instead."""

    __tablename__ = "fee_categories"

    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    def __repr__(self):
        return f"<FeeCategory {self.name}>"
