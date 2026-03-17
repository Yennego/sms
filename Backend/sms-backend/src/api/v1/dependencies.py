from typing import Optional
from fastapi import Query
from pydantic import BaseModel

class CommonQueryParams(BaseModel):
    skip: int = Query(0, ge=0)
    limit: int = Query(10, ge=1, le=100)
    search: Optional[str] = Query(None)
    sort_by: Optional[str] = Query(None)
    sort_order: str = Query("asc", pattern="^(asc|desc)$")
