from .people import router
from .admissions import router as admissions_router

# /people/admissions, /people/admissions/import, /people/guardians/search
router.include_router(admissions_router)

__all__ = ["router"]
