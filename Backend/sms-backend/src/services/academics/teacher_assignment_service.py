from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_

from src.db.crud.academics import class_subject_crud
from src.db.models.academics.class_model import Class
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.subject import Subject
from src.db.models.academics.section import Section
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.people.teacher import Teacher
from src.schemas.academics.class_subject_schema import ClassSubjectCreate, ClassSubjectUpdate
from src.services.base.base import TenantBaseService
from src.core.exceptions.business import EntityNotFoundError, BusinessRuleViolationError, DuplicateEntityError
from src.db.models.people.student import Student
from src.db.models.academics.enrollment import Enrollment
from src.utils.academic_year_validator import validate_academic_year_editable
from src.db.crud.academics.academic_year_crud import academic_year_crud

class TeacherAssignmentService(TenantBaseService[ClassSubject, ClassSubjectCreate, ClassSubjectUpdate]):
    """
    Service for managing teacher subject assignments via ClassSubject.
    Each record represents a teacher assigned to a specific subject within a Class (Grade+Section+Year).
    """
    
    def __init__(self, tenant_id: UUID, db: Session):
        super().__init__(crud=class_subject_crud, model=ClassSubject, tenant_id=tenant_id, db=db)

    async def create(self, *, obj_in: Any) -> ClassSubject:
        """
        Create a new teacher assignment (ClassSubject).
        This method handles legacy 'Class' based creation by looking up/creating the Class container.
        """
        # 1. Get Academic Year
        ay_id = getattr(obj_in, 'academic_year_id', None)
        if not ay_id and hasattr(obj_in, 'academic_year'):
            ay = academic_year_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=obj_in.academic_year)
            if ay:
                ay_id = ay.id
        
        if not ay_id:
             raise BusinessRuleViolationError("Valid academic year is required for assignments.")

        # 2. Validate academic year is not locked
        validate_academic_year_editable(self.db, ay_id, self.tenant_id, operation="create assignments for")
        
        # 3. Find or Create the Class container (Grade + Section + Year)
        grade_id = obj_in.grade_id
        section_id = obj_in.section_id
        
        class_obj = self.db.query(Class).filter(
            Class.tenant_id == self.tenant_id,
            Class.academic_year_id == ay_id,
            Class.grade_id == grade_id,
            Class.section_id == section_id
        ).first()
        
        if not class_obj:
            # Create a new class container if it doesn't exist
            class_obj = Class(
                tenant_id=self.tenant_id,
                academic_year_id=ay_id,
                grade_id=grade_id,
                section_id=section_id,
                is_active=True
            )
            class_obj.generate_name()
            self.db.add(class_obj)
            self.db.flush() # Get the ID

        # 4. Check for existing assignment (ClassSubject)
        subject_id = obj_in.subject_id
        existing = self.db.query(ClassSubject).filter(
            ClassSubject.tenant_id == self.tenant_id,
            ClassSubject.class_id == class_obj.id,
            ClassSubject.subject_id == subject_id
        ).first()

        if existing:
            subject = self.db.query(Subject).filter(Subject.id == subject_id).first()
            subject_name = subject.name if subject else "Unknown Subject"
            
            if str(existing.teacher_id) == str(obj_in.teacher_id):
                 raise DuplicateEntityError(
                    "Assignment", 
                    f"Subject '{subject_name}' is already assigned to this teacher for this class."
                )
            else:
                 existing_teacher = self.db.query(Teacher).filter(Teacher.id == existing.teacher_id).first()
                 teacher_name = f"{existing_teacher.first_name} {existing_teacher.last_name}" if existing_teacher else "another teacher"
                 raise BusinessRuleViolationError(
                     f"Subject '{subject_name}' is already assigned to {teacher_name}. Please remove the existing assignment first."
                 )

        # 5. Create ClassSubject
        assignment = ClassSubject(
            tenant_id=self.tenant_id,
            class_id=class_obj.id,
            subject_id=subject_id,
            teacher_id=obj_in.teacher_id,
            grading_schema_id=getattr(obj_in, 'grading_schema_id', None)
        )
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment
    
    def get_by_teacher(self, teacher_id: UUID, academic_year_id: Optional[UUID] = None, skip: int = 0, limit: int = 100) -> List[ClassSubject]:
        """Get all subject assignments for a specific teacher with primary container info."""
        query = self.db.query(ClassSubject).join(Class).filter(
            ClassSubject.tenant_id == self.tenant_id,
            ClassSubject.teacher_id == teacher_id
        )
        
        if academic_year_id:
            query = query.filter(Class.academic_year_id == academic_year_id)
            
        # Optimize query with joins to prevent N+1
        query = query.options(
            joinedload(ClassSubject.subject),
            joinedload(ClassSubject.teacher),
            joinedload(ClassSubject.class_obj).joinedload(Class.grade),
            joinedload(ClassSubject.class_obj).joinedload(Class.section),
            joinedload(ClassSubject.class_obj).joinedload(Class.academic_year)
        )
        
        return query.offset(skip).limit(limit).all()

    def get_all_assignments(self, academic_year_id: Optional[UUID] = None, skip: int = 0, limit: int = 100) -> List[ClassSubject]:
        """Get all assignments for the tenant with full details."""
        query = self.db.query(ClassSubject).join(Class).filter(
            ClassSubject.tenant_id == self.tenant_id
        )
        
        if academic_year_id:
            query = query.filter(Class.academic_year_id == academic_year_id)
            
        query = query.options(
            joinedload(ClassSubject.subject),
            joinedload(ClassSubject.teacher),
            joinedload(ClassSubject.class_obj).joinedload(Class.grade),
            joinedload(ClassSubject.class_obj).joinedload(Class.section),
            joinedload(ClassSubject.class_obj).joinedload(Class.academic_year)
        )
        
        return query.offset(skip).limit(limit).all()

    def get_assignment_with_details(self, id: UUID) -> Optional[ClassSubject]:
        """Get a specific assignment with all relationships populated."""
        return self.db.query(ClassSubject).filter(
            ClassSubject.tenant_id == self.tenant_id,
            ClassSubject.id == id
        ).options(
            joinedload(ClassSubject.subject),
            joinedload(ClassSubject.teacher),
            joinedload(ClassSubject.class_obj).joinedload(Class.grade),
            joinedload(ClassSubject.class_obj).joinedload(Class.section),
            joinedload(ClassSubject.class_obj).joinedload(Class.academic_year)
        ).first()

    def get_unassigned_subjects(self, academic_year_id: UUID) -> List[Dict]:
        """
        Get subjects that are NOT assigned to any teacher for a specific grade/section.
        """
        # 1. Get all active grades
        grades = self.db.query(AcademicGrade).filter(
            AcademicGrade.tenant_id == self.tenant_id,
            AcademicGrade.is_active == True
        ).order_by(AcademicGrade.sequence).all()
        
        # 2. Get all active subjects
        subjects = self.db.query(Subject).filter(
            Subject.tenant_id == self.tenant_id,
            Subject.is_active == True
        ).all()
        
        # 3. Get all active sections
        sections = self.db.query(Section).filter(
            Section.tenant_id == self.tenant_id,
            Section.is_active == True
        ).all()
        
        # 4. Get existing assignments to filter them out
        existing = self.db.query(ClassSubject).join(Class).filter(
            Class.tenant_id == self.tenant_id,
            Class.academic_year_id == academic_year_id
        ).all()
        
        existing_keys = set()
        for e in existing:
            existing_keys.add((str(e.class_obj.grade_id), str(e.class_obj.section_id), str(e.subject_id)))
            
        results = []
        for g in grades:
            grade_sections = [s for s in sections if s.grade_id == g.id]
            for s in grade_sections:
                for sub in subjects:
                    key = (str(g.id), str(s.id), str(sub.id))
                    if key not in existing_keys:
                        results.append({
                            "grade_id": str(g.id),
                            "section_id": str(s.id),
                            "subject_id": str(sub.id),
                            "grade_name": g.name,
                            "section_name": s.name,
                            "subject_name": sub.name,
                            "class_name": f"{sub.name} - {g.name} {s.name}",
                            "is_assigned": False
                        })
        return results

    def get_teacher_workload(self, academic_year_id: UUID) -> List[Dict]:
        """Get workload stats for all teachers."""
        query = self.db.query(
            ClassSubject.teacher_id,
            func.count(ClassSubject.id).label('total_assignments')
        ).join(Class).filter(
            ClassSubject.tenant_id == self.tenant_id,
            Class.academic_year_id == academic_year_id
        ).group_by(ClassSubject.teacher_id)
        
        results = query.all()
        
        workload = []
        for r in results:
            teacher = self.db.query(Teacher).filter(Teacher.id == r.teacher_id).first()
            if teacher:
                assignments = self.get_by_teacher(r.teacher_id, academic_year_id)
                workload.append({
                    "teacher_id": str(r.teacher_id),
                    "teacher_name": f"{teacher.first_name} {teacher.last_name}",
                    "total_assignments": r.total_assignments,
                    "assignments": assignments
                })
        return workload

    async def get_students_for_class(self, class_subject_id: UUID) -> List[Dict]:
        """Get students enrolled in the class linked to this assignment."""
        assignment = await self.get(class_subject_id)
        if not assignment:
            raise EntityNotFoundError("Assignment", class_subject_id)
            
        class_obj = assignment.class_obj
        enrollments = self.db.query(Enrollment).filter(
            Enrollment.tenant_id == self.tenant_id,
            Enrollment.grade_id == class_obj.grade_id,
            Enrollment.section_id == class_obj.section_id,
            Enrollment.academic_year_id == class_obj.academic_year_id,
            Enrollment.is_active == True,
            Enrollment.status == 'active'
        ).all()
        
        results = []
        for enrollment in enrollments:
            student = self.db.query(Student).filter(Student.id == enrollment.student_id).first()
            if student:
                results.append({
                    "id": str(student.id),
                    "first_name": student.first_name,
                    "last_name": student.last_name,
                    "admission_number": student.admission_number,
                    "gender": student.gender or "Unknown",
                    "enrollment_id": str(enrollment.id)
                })
        results.sort(key=lambda x: (x['first_name'], x['last_name']))
        return results

    async def bulk_delete(self, ids: List[UUID]) -> int:
        total_deleted = 0
        for rid in ids:
            assignment = await self.get(rid)
            if assignment:
                validate_academic_year_editable(self.db, assignment.class_obj.academic_year_id, self.tenant_id, operation="delete")
                self.db.delete(assignment)
                total_deleted += 1
        
        if total_deleted > 0:
            self.db.commit()
        return total_deleted

    async def bulk_reassign(self, ids: List[UUID], new_teacher_id: UUID, new_academic_year_id: Optional[UUID] = None) -> int:
        """Bulk reassign teacher for multiple assignments."""
        assignments = self.db.query(ClassSubject).filter(
            ClassSubject.id.in_(ids),
            ClassSubject.tenant_id == self.tenant_id
        ).all()
        
        count = 0
        for a in assignments:
            a.teacher_id = new_teacher_id
            count += 1
        
        self.db.commit()
        return count

    async def bulk_delete(self, ids: List[UUID]) -> int:
        """Bulk delete assignments (ClassSubject)."""
        assignments = self.db.query(ClassSubject).filter(
            ClassSubject.id.in_(ids),
            ClassSubject.tenant_id == self.tenant_id
        ).all()
        
        count = 0
        for a in assignments:
            self.db.delete(a)
            count += 1
            
        self.db.commit()
        return count

    def assign_section_sponsor(self, section_id: UUID, teacher_id: UUID) -> Section:
        section = self.db.query(Section).filter(Section.id == section_id, Section.tenant_id == self.tenant_id).first()
        if not section: raise EntityNotFoundError("Section", section_id)
        
        teacher = self.db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if not teacher: raise EntityNotFoundError("Teacher", teacher_id)
        
        section.class_teacher_id = teacher_id
        if not teacher.is_class_teacher:
            teacher.is_class_teacher = True
        self.db.commit()
        return section

    def get_class_sponsors(self, academic_year_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
        sections = self.db.query(Section).filter(Section.tenant_id == self.tenant_id, Section.is_active == True).options(
            joinedload(Section.grade), joinedload(Section.class_teacher)
        ).all()
        
        results = []
        for s in sections:
            results.append({
                "section_id": str(s.id),
                "section_name": s.name,
                "grade_id": str(s.grade_id),
                "grade_name": s.grade.name if s.grade else "Unknown",
                "teacher_id": str(s.class_teacher_id) if s.class_teacher_id else None,
                "teacher_name": f"{s.class_teacher.first_name} {s.class_teacher.last_name}" if s.class_teacher else None,
                "is_assigned": s.class_teacher_id is not None
            })
        return results
