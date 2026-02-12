from typing import List, Optional, Any
from sqlalchemy import func
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from uuid import uuid4

from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.db.crud.academics.semester_crud import semester_crud
from src.db.crud.academics.period_crud import period_crud
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.semester import Semester
from src.db.models.academics.period import Period
from src.schemas.academics.academic_year import AcademicYearCreate, AcademicYearUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError, DuplicateEntityError, BusinessRuleViolationError
from src.db.session import get_db, get_super_admin_db
from src.core.middleware.tenant import get_tenant_from_request


class AcademicYearService(TenantBaseService[AcademicYear, AcademicYearCreate, AcademicYearUpdate]):
    """Service for managing academic years within a tenant."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        # Extract tenant_id from the Tenant object
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=academic_year_crud, model=AcademicYear, tenant_id=tenant_id, db=db)
    
    async def get_current(self) -> Optional[AcademicYear]:
        """Get the current academic year."""
        return academic_year_crud.get_current(self.db, tenant_id=self.tenant_id)
    
    async def get_by_name(self, name: str) -> Optional[AcademicYear]:
        """Get an academic year by name."""
        return academic_year_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=name)
    
    async def get_active_years(self, skip: int = 0, limit: int = 100) -> List[AcademicYear]:
        """Get all active academic years for the tenant."""
        return academic_year_crud.get_active_years(self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)

    def _enrich_years(self, years: List[AcademicYear]) -> List[Any]:
        if not years:
            return []
            
        from src.db.models.academics.enrollment import Enrollment
        from src.db.models.academics.class_model import Class
        from src.schemas.academics.academic_year import AcademicYearWithDetails
        
        # Get all year IDs and names
        year_ids = [y.id for y in years]
        year_names = [y.name for y in years]
        
        # 1. Bulk Students Count
        student_counts = dict(
            self.db.query(Enrollment.academic_year_id, func.count(Enrollment.id))
            .filter(
                Enrollment.tenant_id == self.tenant_id,
                Enrollment.academic_year_id.in_(year_ids),
                Enrollment.status == 'active'
            )
            .group_by(Enrollment.academic_year_id)
            .all()
        )
        
        # 2. Bulk Classes Count
        class_counts = dict(
            self.db.query(Class.academic_year_id, func.count(Class.id))
            .filter(
                Class.tenant_id == self.tenant_id,
                Class.academic_year_id.in_(year_ids),
                Class.is_active == True
            )
            .group_by(Class.academic_year_id)
            .all()
        )
        
        enriched = []
        for ay in years:
            data = {c.name: getattr(ay, c.name) for c in ay.__table__.columns}
            enriched.append(AcademicYearWithDetails(
                **data,
                total_students=student_counts.get(ay.id, 0),
                total_classes=class_counts.get(ay.id, 0)
            ))
        return enriched

    async def list_enriched(self, skip: int = 0, limit: int = 100) -> List[Any]:
        years = await self.list(skip=skip, limit=limit)
        return self._enrich_years(years)

    async def get_active_years_enriched(self, skip: int = 0, limit: int = 100) -> List[Any]:
        years = await self.get_active_years(skip=skip, limit=limit)
        return self._enrich_years(years)

    async def get_current_enriched(self) -> Optional[Any]:
        year = await self.get_current()
        if not year:
            return None
        return self._enrich_years([year])[0]
    
    async def create(self, *, obj_in: AcademicYearCreate) -> AcademicYear:
        """Create a new academic year with validation and auto-seed semesters/periods."""
        # Check for duplicate academic year name
        existing = await self.get_by_name(obj_in.name)
        if existing:
            raise DuplicateEntityError("AcademicYear", "name", obj_in.name)
        
        # If semester dates are missing, calculate intelligent defaults
        if not all([obj_in.semester_1_start, obj_in.semester_1_end, 
                   obj_in.semester_2_start, obj_in.semester_2_end]):
            total_duration = obj_in.end_date - obj_in.start_date
            half_duration = total_duration / 2
            
            # Semester 1: Start of year to middle
            if not obj_in.semester_1_start:
                obj_in.semester_1_start = obj_in.start_date
            if not obj_in.semester_1_end:
                obj_in.semester_1_end = obj_in.start_date + half_duration
                
            # Semester 2: One day after S1 ends to end of year
            if not obj_in.semester_2_start:
                obj_in.semester_2_start = obj_in.semester_1_end + timedelta(days=1)
            if not obj_in.semester_2_end:
                obj_in.semester_2_end = obj_in.end_date

        # Validate semester dates
        self._validate_semester_dates(obj_in)
        
        # If this is set as current, unset other current years
        if obj_in.is_current:
            self._unset_current_years()
        
        # Create the academic year
        db_obj = await super().create(obj_in=obj_in)
        
        # Auto-seed Semesters and Periods
        self._seed_academic_year(db_obj)
        
        return db_obj

    def _seed_academic_year(self, ay: AcademicYear) -> None:
        """Automatically create 2 semesters and 6 periods for a new academic year."""
        # Semester 1
        s1 = Semester(
            id=uuid4(),
            tenant_id=self.tenant_id,
            academic_year_id=ay.id,
            name="1st Semester",
            semester_number=1,
            start_date=ay.semester_1_start,
            end_date=ay.semester_1_end,
            is_active=True
        )
        self.db.add(s1)
        
        # Semester 2
        s2 = Semester(
            id=uuid4(),
            tenant_id=self.tenant_id,
            academic_year_id=ay.id,
            name="2nd Semester",
            semester_number=2,
            start_date=ay.semester_2_start,
            end_date=ay.semester_2_end,
            is_active=True
        )
        self.db.add(s2)
        self.db.flush() # Ensure s1.id and s2.id are available
        
        # Periods for Semester 1 (1-3)
        s1_duration = ay.semester_1_end - ay.semester_1_start
        for i in range(3):
            p_start = ay.semester_1_start + (s1_duration / 3) * i
            p_end = ay.semester_1_start + (s1_duration / 3) * (i + 1)
            p = Period(
                id=uuid4(),
                tenant_id=self.tenant_id,
                semester_id=s1.id,
                name=f"Period {i+1}",
                period_number=i+1,
                start_date=p_start,
                end_date=p_end,
                is_active=True
            )
            self.db.add(p)
            
        # Periods for Semester 2 (4-6)
        s2_duration = ay.semester_2_end - ay.semester_2_start
        for i in range(3):
            idx = i + 3
            p_start = ay.semester_2_start + (s2_duration / 3) * i
            p_end = ay.semester_2_start + (s2_duration / 3) * (i + 1)
            p = Period(
                id=uuid4(),
                tenant_id=self.tenant_id,
                semester_id=s2.id,
                name=f"Period {idx+1}",
                period_number=idx+1,
                start_date=p_start,
                end_date=p_end,
                is_active=True
            )
            self.db.add(p)
            
        self.db.commit()
    
    async def update(self, *, db_obj: AcademicYear, obj_in: AcademicYearUpdate) -> AcademicYear:
        """Update an academic year with validation."""
        # Check for duplicate name if name is being updated
        if obj_in.name and obj_in.name != db_obj.name:
            existing = await self.get_by_name(obj_in.name)
            if existing:
                raise DuplicateEntityError("AcademicYear", "name", obj_in.name)
        
        # Validate semester dates if any are being updated
        if any([obj_in.semester_1_start, obj_in.semester_1_end, obj_in.semester_2_start, obj_in.semester_2_end]):
            # Create a temporary object for validation
            temp_obj = AcademicYearCreate(
                name=obj_in.name or db_obj.name,
                start_date=obj_in.start_date or db_obj.start_date,
                end_date=obj_in.end_date or db_obj.end_date,
                semester_1_start=obj_in.semester_1_start or db_obj.semester_1_start,
                semester_1_end=obj_in.semester_1_end or db_obj.semester_1_end,
                semester_2_start=obj_in.semester_2_start or db_obj.semester_2_start,
                semester_2_end=obj_in.semester_2_end or db_obj.semester_2_end
            )
            self._validate_semester_dates(temp_obj)
        
        # If setting as current, unset other current years
        if obj_in.is_current and not db_obj.is_current:
            self._unset_current_years()
        
        updated_ay = await self.crud.update(db=self.db, tenant_id=self.tenant_id, db_obj=db_obj, obj_in=obj_in)
        
        # Sync semester dates if they were updated
        if any([obj_in.semester_1_start, obj_in.semester_1_end, obj_in.semester_2_start, obj_in.semester_2_end]):
            self._sync_semesters_dates(updated_ay)
            
        return updated_ay

    def _sync_semesters_dates(self, ay: AcademicYear) -> None:
        """Propagate date changes from AcademicYear to its Semesters."""
        # Semester 1
        s1 = self.db.query(Semester).filter(
            Semester.academic_year_id == ay.id,
            Semester.semester_number == 1
        ).first()
        if s1:
            s1.start_date = ay.semester_1_start
            s1.end_date = ay.semester_1_end
            
        # Semester 2
        s2 = self.db.query(Semester).filter(
            Semester.academic_year_id == ay.id,
            Semester.semester_number == 2
        ).first()
        if s2:
            s2.start_date = ay.semester_2_start
            s2.end_date = ay.semester_2_end
            
        self.db.commit()
    
    async def set_current_year(self, academic_year_id: UUID) -> AcademicYear:
        """Set a specific academic year as current."""
        academic_year = await self.get(academic_year_id)
        if not academic_year:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        
        return academic_year_crud.set_current_year(self.db, tenant_id=self.tenant_id, academic_year_id=academic_year_id)
    
    async def advance_semester(self, academic_year_id: UUID) -> AcademicYear:
        """Advance to the next semester within the academic year."""
        academic_year = await self.get(academic_year_id)
        if not academic_year:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        
        if academic_year.current_semester == 1:
            # Check if we can advance to semester 2
            today = date.today()
            if today >= academic_year.semester_2_start:
                academic_year.current_semester = 2
                self.db.commit()
                self.db.refresh(academic_year)
            else:
                raise BusinessRuleViolationError("Cannot advance to semester 2 before its start date")
        else:
            raise BusinessRuleViolationError("Already in the final semester of the academic year")
        
        return academic_year
    
    async def archive(self, academic_year_id: UUID) -> AcademicYear:
        """Archive an academic year."""
        academic_year = await self.get(academic_year_id)
        if not academic_year:
            raise EntityNotFoundError("AcademicYear", academic_year_id)
        
        if academic_year.is_current:
            raise BusinessRuleViolationError("Cannot archive the current academic year")
            
        academic_year.is_archived = True
        academic_year.is_active = False
        self.db.commit()
        self.db.refresh(academic_year)
        return academic_year
    
    def _validate_semester_dates(self, obj_in: AcademicYearCreate) -> None:
        """Validate semester dates are logical."""
        if obj_in.start_date >= obj_in.end_date:
            raise BusinessRuleViolationError("Academic year start date must be before end date")
        
        if obj_in.semester_1_start >= obj_in.semester_1_end:
            raise BusinessRuleViolationError("Semester 1 start date must be before end date")
        
        if obj_in.semester_2_start >= obj_in.semester_2_end:
            raise BusinessRuleViolationError("Semester 2 start date must be before end date")
        
        if obj_in.semester_1_end >= obj_in.semester_2_start:
            raise BusinessRuleViolationError("Semester 1 must end before Semester 2 starts")
        
        if obj_in.semester_1_start < obj_in.start_date or obj_in.semester_2_end > obj_in.end_date:
            raise BusinessRuleViolationError("Semester dates must be within academic year dates")
    
    def _unset_current_years(self) -> None:
        """Unset all current academic years for the tenant."""
        self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.is_current == True
        ).update({"is_current": False})
        self.db.commit()


class SuperAdminAcademicYearService(SuperAdminBaseService[AcademicYear, AcademicYearCreate, AcademicYearUpdate]):
    """Super-admin service for managing academic years across all tenants."""
    
    def __init__(self, db: Session = Depends(get_super_admin_db)):
        super().__init__(crud=academic_year_crud, model=AcademicYear, db=db)
    
    def get_all_years(self, skip: int = 0, limit: int = 100,
                     is_active: Optional[bool] = None,
                     is_current: Optional[bool] = None,
                     tenant_id: Optional[UUID] = None) -> List[AcademicYear]:
        """Get all academic years across all tenants with filtering."""
        query = self.db.query(AcademicYear)
        
        # Apply filters
        if is_active is not None:
            query = query.filter(AcademicYear.is_active == is_active)
        if is_current is not None:
            query = query.filter(AcademicYear.is_current == is_current)
        if tenant_id:
            query = query.filter(AcademicYear.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()