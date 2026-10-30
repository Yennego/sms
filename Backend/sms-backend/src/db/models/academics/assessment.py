from sqlalchemy import Column, String, ForeignKey, Float, Date, Text, Index, CheckConstraint, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

# Kinds of gradable activity (docs/remodel/phase4-design.md §2). "exam" is the semester exam;
# every other kind belongs to a period and a grading category.
ASSESSMENT_KINDS = ("test", "quiz", "assignment", "project", "participation", "exam", "other")
_KIND_LIST = ", ".join(f"'{k}'" for k in ASSESSMENT_KINDS)


class Assessment(TenantModel):
    """Every gradable activity: a test, quiz, assignment, ... in a period, or the semester exam.

    class_subject_id names the class, the subject and the teacher allowed to grade it. Marks are
    ScoreEntry rows. subject_id is kept (copied from the class subject) for subject lookups.
    """

    __tablename__ = "assessments"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    class_subject_id = Column(UUID(as_uuid=True), ForeignKey("class_subjects.id"), nullable=False)
    class_subject = relationship("ClassSubject")
    kind = Column(String(20), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("periods.id"), nullable=True)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"), nullable=True)
    grading_category_id = Column(UUID(as_uuid=True), ForeignKey("grading_categories.id"), nullable=True)
    grading_category = relationship("GradingCategory", backref="assessments")

    assessment_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=True)
    max_score = Column(Float, nullable=False, default=100.0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    subject = relationship("Subject")

    scores = relationship("ScoreEntry", back_populates="assessment", cascade="all, delete-orphan",
                          passive_deletes=True)

    __table_args__ = (
        CheckConstraint(f"kind IN ({_KIND_LIST})", name="ck_assessments_kind"),
        CheckConstraint("max_score > 0", name="ck_assessments_max_score_positive"),
        CheckConstraint(
            "(kind = 'exam' AND semester_id IS NOT NULL AND period_id IS NULL AND grading_category_id IS NULL) "
            "OR (kind <> 'exam' AND period_id IS NOT NULL AND semester_id IS NULL AND grading_category_id IS NOT NULL)",
            name="ck_assessments_kind_columns",
        ),
        Index("ix_assessments_class_subject_period", "tenant_id", "class_subject_id", "period_id"),
        Index("uq_assessments_one_exam", "tenant_id", "class_subject_id", "semester_id", unique=True,
              postgresql_where=text("kind = 'exam'"), sqlite_where=text("kind = 'exam'")),
    )

    def __repr__(self):
        return f"<Assessment {self.title} ({self.kind}) - {self.class_subject_id}>"
