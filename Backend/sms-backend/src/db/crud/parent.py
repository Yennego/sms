def add_student(db: Session, tenant_id: Any, parent_id: UUID, student_id: UUID, commit: bool = True) -> Optional[Parent]:
    """Add a student to a parent's list of students."""
    parent = get_by_id(db, tenant_id=tenant_id, id=parent_id)
    if not parent:
        return None
        
    student = db.query(Student).filter(
        Student.tenant_id == tenant_id,
        Student.id == student_id
    ).first()
    if not student:
        raise ValueError(f"Student with ID {student_id} not found")
        
    parent.students.append(student)
    db.add(parent)
    
    if commit:
        db.commit()
        db.refresh(parent)
    
    return parent