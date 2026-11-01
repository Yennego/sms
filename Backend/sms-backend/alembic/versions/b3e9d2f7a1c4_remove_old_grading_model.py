"""
remove_old_grading_model

Removes what is left of the pre-Phase-4 grading model (docs/remodel/phase4-design.md §2).
Grading runs on assessments (class_subject_id/kind/period/semester), score_entries,
result_publications and grading_settings.

1. grades: every row must already be in score_entries (the Phase 4 migration copied them).
   Stragglers whose assessment exists are copied now (latest row per assessment and student);
   if any row still has no assessment, the migration stops and lists them instead of losing marks.
2. exams: every row must already be an assessment (same id, kind 'exam'); otherwise the
   migration stops and lists them.
3. Drops the grades and exams tables.
4. Drops the legacy assessments columns type, teacher_id, grade_id, section_id, class_id,
   academic_year_id, is_published (their composite keys go with them); subject_id stays.
5. Drops periods.is_published and semesters.is_published (publication is per class:
   result_publications).
6. Drops the gradetype enum when nothing uses it any more.

Downgrade recreates the tables and columns with their keys, indexes and row level security,
but EMPTY: the dropped marks, exams and publish flags can't come back (score_entries,
assessments and result_publications keep the real data). The legacy assessments columns are
refilled from each assessment's class subject.

Revision ID: b3e9d2f7a1c4
Revises: e7d2c4a9b1f6
Create Date: 2026-10-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision = 'b3e9d2f7a1c4'
down_revision = 'e7d2c4a9b1f6'
branch_labels = None
depends_on = None

TAG = "[remove_old_grading_model]"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
GRADE_TYPES = ("ASSIGNMENT", "QUIZ", "TEST", "EXAM", "PROJECT", "PARTICIPATION", "ATTENDANCE", "OTHER")
KIND_TO_TYPE = {"test": "TEST", "quiz": "QUIZ", "assignment": "ASSIGNMENT", "project": "PROJECT",
                "participation": "PARTICIPATION", "exam": "EXAM", "other": "OTHER"}
ASSESSMENT_KEYS = (
    # column, target table
    ("teacher_id", "users"),
    ("grade_id", "academic_grades"),
    ("section_id", "sections"),
    ("class_id", "classes"),
    ("academic_year_id", "academic_years"),
)


def _bypass_rls(bind):
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def _ids(bind, sql):
    return [str(r[0]) for r in bind.execute(sa.text(sql))]


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    # 1. grades -> score_entries: copy stragglers, refuse to drop marks that have nowhere to go
    copied = bind.execute(sa.text("""
        INSERT INTO score_entries (id, tenant_id, assessment_id, student_id, enrollment_id, score, status,
                                   comment, entered_by, entered_at, created_at, updated_at)
        SELECT gen_random_uuid(), g.tenant_id, g.assessment_id, g.student_id, g.enrollment_id,
               GREATEST(g.score, 0), 'scored', g.comments, g.graded_by, g.created_at, g.created_at, g.updated_at
        FROM (
            SELECT DISTINCT ON (g.tenant_id, g.assessment_id, g.student_id) g.*
            FROM grades g
            JOIN assessments a ON a.id = g.assessment_id AND a.tenant_id = g.tenant_id
            WHERE NOT EXISTS (SELECT 1 FROM score_entries s WHERE s.tenant_id = g.tenant_id
                              AND s.assessment_id = g.assessment_id AND s.student_id = g.student_id)
            ORDER BY g.tenant_id, g.assessment_id, g.student_id, g.updated_at DESC, g.created_at DESC
        ) g
    """)).rowcount
    print(f"{TAG} grades rows copied to score_entries now: {copied}")
    lost = _ids(bind, """
        SELECT g.id FROM grades g
        WHERE NOT EXISTS (SELECT 1 FROM score_entries s WHERE s.tenant_id = g.tenant_id
                          AND s.assessment_id = g.assessment_id AND s.student_id = g.student_id)
    """)
    if lost:
        raise RuntimeError(f"{TAG} {len(lost)} grades rows have no assessment and would be lost; "
                           f"move or delete them first: {', '.join(lost[:50])}")

    # 2. exams -> assessments
    stray = _ids(bind, """
        SELECT e.id FROM exams e
        WHERE NOT EXISTS (SELECT 1 FROM assessments a WHERE a.id = e.id AND a.tenant_id = e.tenant_id)
    """)
    if stray:
        raise RuntimeError(f"{TAG} {len(stray)} exams rows were never moved to assessments; "
                           f"move or delete them first: {', '.join(stray[:50])}")

    # 3. old tables
    op.drop_table('grades')
    op.drop_table('exams')

    # 4. legacy assessments columns (their fk_tn_ keys are dropped with them)
    for column in ('type', 'is_published') + tuple(c for c, _ in ASSESSMENT_KEYS):
        op.drop_column('assessments', column)

    # 5. global publish flags
    op.drop_column('periods', 'is_published')
    op.drop_column('semesters', 'is_published')

    # 6. the enum, unless something else (e.g. assessments_unmigrated) still uses it
    used = bind.execute(sa.text("""
        SELECT count(*) FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
        WHERE t.typname = 'gradetype' AND a.attnum > 0 AND NOT a.attisdropped
    """)).scalar()
    if not used:
        op.execute("DROP TYPE IF EXISTS gradetype")
    else:
        print(f"{TAG} gradetype kept: still used by {used} column(s)")


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    values = ", ".join(f"'{t}'" for t in GRADE_TYPES)
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gradetype') THEN
                CREATE TYPE gradetype AS ENUM ({values});
            END IF;
        END $$
    """)

    # 5. publish flags (empty: nothing is published by flag)
    op.add_column('semesters', sa.Column('is_published', sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column('periods', sa.Column('is_published', sa.Boolean(), nullable=True, server_default=sa.false()))

    # 4. legacy assessments columns, refilled from the class subject
    gradetype = ENUM(*GRADE_TYPES, name='gradetype', create_type=False)
    op.add_column('assessments', sa.Column('type', gradetype, nullable=True))
    op.add_column('assessments', sa.Column('is_published', sa.Boolean(), nullable=True))
    for column, _ in ASSESSMENT_KEYS:
        op.add_column('assessments', sa.Column(column, sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    cases = " ".join(f"WHEN '{k}' THEN '{v}'" for k, v in KIND_TO_TYPE.items())
    bind.execute(sa.text(f"""
        UPDATE assessments a SET
            type = CAST(CASE a.kind {cases} ELSE 'OTHER' END AS gradetype),
            is_published = false,
            teacher_id = COALESCE(cs.teacher_id, a.created_by),
            grade_id = c.grade_id, section_id = c.section_id, class_id = c.id,
            academic_year_id = c.academic_year_id
        FROM class_subjects cs JOIN classes c ON c.id = cs.class_id AND c.tenant_id = cs.tenant_id
        WHERE cs.id = a.class_subject_id AND cs.tenant_id = a.tenant_id
    """))
    for column in ('type', 'is_published', 'teacher_id', 'grade_id', 'academic_year_id'):
        missing = bind.execute(sa.text(f"SELECT count(*) FROM assessments WHERE {column} IS NULL")).scalar()
        if missing:
            print(f"{TAG} assessments.{column} left nullable: {missing} rows have no value")
        else:
            op.alter_column('assessments', column, nullable=False)
    for column, target in ASSESSMENT_KEYS:
        op.create_foreign_key(f'fk_tn_assessments_{column}', 'assessments', target,
                              ['tenant_id', column], ['tenant_id', 'id'])

    # 3. old tables, empty
    op.create_table(
        'exams',
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('teacher_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('grade_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('exam_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('max_score', sa.Float(), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='RESTRICT', name='exams_tenant_id_fkey'), nullable=False),
        sa.Column('academic_year_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('ix_exams_tenant_id', 'exams', ['tenant_id'])
    for column, target in (("academic_year_id", "academic_years"), ("grade_id", "academic_grades"),
                           ("section_id", "sections"), ("subject_id", "subjects"), ("teacher_id", "users")):
        op.create_foreign_key(f'fk_tn_exams_{column}', 'exams', target, ['tenant_id', column], ['tenant_id', 'id'])
    _enable_rls('exams')

    op.create_table(
        'grades',
        sa.Column('student_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('enrollment_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assessment_type', gradetype, nullable=False),
        sa.Column('assessment_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assessment_name', sa.String(255), nullable=False),
        sa.Column('assessment_date', sa.Date(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('max_score', sa.Float(), nullable=False),
        sa.Column('percentage', sa.Float(), nullable=False),
        sa.Column('letter_grade', sa.String(10), nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('graded_by', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', name='grades_graded_by_fkey'), nullable=False),
        sa.Column('graded_date', sa.Date(), nullable=False),
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='RESTRICT', name='grades_tenant_id_fkey'), nullable=False),
        sa.Column('period_number', sa.Integer(), nullable=True),
        sa.Column('semester', sa.Integer(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('period_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('semester_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('grading_category_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('idx_grades_assessment_id', 'grades', ['assessment_id'])
    op.create_index('idx_grades_assessment_type', 'grades', ['assessment_type'])
    op.create_index('idx_grades_student_id', 'grades', ['student_id'])
    op.create_index('idx_grades_tenant_id_student_id', 'grades', ['tenant_id', 'student_id'])
    op.create_index('ix_grades_assessment_lookup', 'grades', ['tenant_id', 'assessment_id', 'assessment_type'])
    op.create_index('ix_grades_student_subject', 'grades', ['tenant_id', 'student_id', 'subject_id'])
    op.create_index('ix_grades_tenant_id', 'grades', ['tenant_id'])
    for column, target in (("enrollment_id", "enrollments"), ("grading_category_id", "grading_categories"),
                           ("student_id", "students"), ("subject_id", "subjects")):
        op.create_foreign_key(f'fk_tn_grades_{column}', 'grades', target, ['tenant_id', column], ['tenant_id', 'id'])
    for column, target in (("period_id", "periods"), ("semester_id", "semesters")):
        op.execute(f"ALTER TABLE grades ADD CONSTRAINT fk_tn_grades_{column} FOREIGN KEY (tenant_id, {column}) "
                   f"REFERENCES {target}(tenant_id, id) ON DELETE SET NULL ({column})")
    _enable_rls('grades')
