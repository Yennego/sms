"""
phase4_gradebook

Grades and report cards (docs/remodel/phase4-design.md §2).

1. assessments becomes the single table for every gradable activity: class_subject_id (required,
   composite FK to class_subjects), kind, period_id / semester_id, due_date, created_by, plus
   checks (kind list, max_score > 0, a period kind has a period and a category, the semester exam
   has a semester and no category) and one exam per class subject and semester.
   Existing rows are matched to their class subject (class, else year/grade/section/subject),
   period (from their marks, else by date) and category (by name when missing). Rows that can't
   be matched are reported and moved to `assessments_unmigrated` (restored on downgrade).
2. exams and assignments rows become assessments (same ids; kind exam / assignment), matched the
   same way; unmatched rows are reported and skipped. The old tables stay.
3. score_entries (the new mark table), result_publications, grading_settings, with row level
   security and composite tenant keys.
4. grades rows -> score_entries where the assessment is found (latest row per student and
   assessment); the rest are reported. grades stays, read-only.
5. periods.is_published -> a publication for every class of that year; semesters.is_published
   -> a semester publication only when all the semester's periods are published (the publish
   rule), otherwise reported.
6. Promotion statuses saved as "Repeating" / "No grades recorded" are deleted (never real
   decisions).
7. Permission publish_results (admin, academic-admin). The teacher system role loses
   view_academic_data (unused until now): with it, every teacher could read every class's
   unpublished marks; teachers see their own class subjects and sponsored classes instead.

Downgrade drops the new tables and columns and the migrated exam/assignment assessments, moves
unmatched rows back and restores the role permissions. Deleted promotion statuses are not
restored.

Revision ID: f6c2a9d4b8e3
Revises: d8f3b6a2c5e1
Create Date: 2026-10-29 12:00:00.000000

"""
import uuid
from collections import Counter, defaultdict

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'f6c2a9d4b8e3'
down_revision = 'd8f3b6a2c5e1'
branch_labels = None
depends_on = None

TAG = "[phase4_gradebook]"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
KINDS = ("test", "quiz", "assignment", "project", "participation", "exam", "other")
TYPE_TO_KIND = {
    "TEST": "test", "QUIZ": "quiz", "ASSIGNMENT": "assignment", "PROJECT": "project",
    "PARTICIPATION": "participation", "OTHER": "other", "ATTENDANCE": "other",
    # An old assessments row of type EXAM sits inside a period with a category (e.g. "Exam 30%"):
    # it is a period assessment, not the semester exam
    "EXAM": "test",
}


def _bypass_rls(bind):
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _rows(bind, sql, **params):
    return bind.execute(sa.text(sql), params).mappings().all()


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


class _Lookup:
    """School data needed to place old rows: class subjects, periods, semesters, categories."""

    def __init__(self, bind):
        self.cs_by_class = {}
        self.cs_by_identity = defaultdict(list)
        self.cs_by_grade = defaultdict(list)
        for r in _rows(bind, """
            SELECT cs.id, cs.tenant_id, cs.subject_id, cs.teacher_id, cs.grading_schema_id,
                   c.id AS class_id, c.academic_year_id, c.grade_id, c.section_id
            FROM class_subjects cs JOIN classes c ON c.id = cs.class_id AND c.tenant_id = cs.tenant_id
        """):
            self.cs_by_class[(r["tenant_id"], r["subject_id"], r["class_id"])] = r
            self.cs_by_identity[(r["tenant_id"], r["subject_id"], r["academic_year_id"], r["grade_id"], r["section_id"])].append(r)
            self.cs_by_grade[(r["tenant_id"], r["subject_id"], r["academic_year_id"], r["grade_id"])].append(r)

        self.periods = defaultdict(list)  # (tenant, year) -> periods by number
        for r in _rows(bind, """
            SELECT p.id, p.tenant_id, p.semester_id, p.period_number, p.start_date, p.end_date, s.academic_year_id
            FROM periods p JOIN semesters s ON s.id = p.semester_id AND s.tenant_id = p.tenant_id
            ORDER BY p.period_number
        """):
            self.periods[(r["tenant_id"], r["academic_year_id"])].append(r)
        self.period_year = {p["id"]: y for (t, y), ps in self.periods.items() for p in ps}

        self.semesters = defaultdict(list)
        for r in _rows(bind, "SELECT id, tenant_id, academic_year_id, semester_number, start_date, end_date "
                             "FROM semesters ORDER BY semester_number"):
            self.semesters[(r["tenant_id"], r["academic_year_id"])].append(r)

        self.categories = defaultdict(list)  # tenant -> categories with their schema
        for r in _rows(bind, """
            SELECT gc.id, gc.tenant_id, gc.name, gc.schema_id, gs.academic_year_id, gs.is_active
            FROM grading_categories gc JOIN grading_schemas gs ON gs.id = gc.schema_id AND gs.tenant_id = gc.tenant_id
        """):
            self.categories[r["tenant_id"]].append(r)

        # Which period an assessment's marks were recorded in (old marks carry period_id)
        self.mark_periods = defaultdict(Counter)
        for r in _rows(bind, "SELECT tenant_id, assessment_id, period_id FROM grades "
                             "WHERE assessment_id IS NOT NULL AND period_id IS NOT NULL"):
            self.mark_periods[(r["tenant_id"], r["assessment_id"])][r["period_id"]] += 1

    def class_subject(self, tenant, subject, class_id, year, grade, section):
        if class_id is not None:
            found = self.cs_by_class.get((tenant, subject, class_id))
            if found:
                return found
        if section is not None:
            found = self.cs_by_identity.get((tenant, subject, year, grade, section), [])
        else:
            found = self.cs_by_grade.get((tenant, subject, year, grade), [])
        return found[0] if len(found) == 1 else None

    def period(self, tenant, row_id, year, *dates):
        marks = self.mark_periods.get((tenant, row_id))
        if marks:
            period_id = marks.most_common(1)[0][0]
            if self.period_year.get(period_id) == year:
                return period_id
        for d in dates:
            if d is None:
                continue
            for p in self.periods.get((tenant, year), []):
                if p["start_date"] <= d <= p["end_date"]:
                    return p["id"]
        return None

    def semester(self, tenant, year, d):
        for s in self.semesters.get((tenant, year), []):
            if d is not None and s["start_date"] <= d <= s["end_date"]:
                return s["id"]
        return None

    def category(self, tenant, cs, year, *names):
        wanted = set()
        for n in names:
            if n:
                n = n.lower()
                wanted |= {n, n + "s", n + "es", n + "zes"}
        matches = [c for c in self.categories.get(tenant, []) if c["name"].strip().lower() in wanted]
        if not matches:
            return None
        matches.sort(key=lambda c: (
            c["schema_id"] != cs["grading_schema_id"],
            c["academic_year_id"] != year,
            not c["is_active"],
            c["academic_year_id"] is not None,
        ))
        return matches[0]["id"]


def _report(kind, rows, reason):
    if rows:
        print(f"{TAG} {len(rows)} {kind} skipped ({reason}): " + ", ".join(str(r) for r in rows[:50])
              + (" ..." if len(rows) > 50 else ""))


def _migrate_assessments(bind, look):
    """Fill the new columns of existing assessments rows; returns ids that couldn't be placed."""
    unplaced = []
    updates = []
    for a in _rows(bind, "SELECT * FROM assessments"):
        t, year = a["tenant_id"], a["academic_year_id"]
        cs = look.class_subject(t, a["subject_id"], a["class_id"], year, a["grade_id"], a["section_id"])
        if cs is None:
            unplaced.append((a["id"], "no class subject"))
            continue
        kind = TYPE_TO_KIND.get(a["type"], "other")
        period_id = look.period(t, a["id"], year, a["assessment_date"])
        category_id = a["grading_category_id"] or look.category(t, cs, year, kind, a["type"])
        if period_id is None or category_id is None:
            unplaced.append((a["id"], "no period" if period_id is None else "no grading category"))
            continue
        updates.append({
            "id": a["id"], "cs": cs["id"], "kind": kind, "period": period_id, "cat": category_id,
            "class_id": cs["class_id"], "section_id": cs["section_id"], "grade_id": cs["grade_id"],
        })
    if updates:
        bind.execute(sa.text("""
            UPDATE assessments SET class_subject_id = :cs, kind = :kind, period_id = :period,
                   grading_category_id = :cat, created_by = teacher_id,
                   class_id = :class_id, section_id = :section_id, grade_id = :grade_id
            WHERE id = :id
        """), updates)
    print(f"{TAG} assessments: {len(updates)} placed in a class subject and period")
    return unplaced


def _insert_assessments(bind, values):
    if not values:
        return
    bind.execute(sa.text("""
        INSERT INTO assessments (
            id, tenant_id, title, description, type, subject_id, teacher_id, academic_year_id,
            grade_id, section_id, class_id, grading_category_id, assessment_date, max_score,
            is_published, created_at, updated_at,
            class_subject_id, kind, period_id, semester_id, due_date, created_by
        ) VALUES (
            :id, :tenant_id, :title, :description, CAST(:type AS gradetype), :subject_id, :teacher_id,
            :academic_year_id, :grade_id, :section_id, :class_id, :grading_category_id, :assessment_date,
            :max_score, false, :created_at, :updated_at,
            :class_subject_id, :kind, :period_id, :semester_id, :due_date, :teacher_id
        )
    """), values)


def _migrate_assignments(bind, look):
    values, skipped = [], []
    for a in _rows(bind, "SELECT * FROM assignments"):
        t, year = a["tenant_id"], a["academic_year_id"]
        cs = look.class_subject(t, a["subject_id"], None, year, a["grade_id"], a["section_id"])
        if cs is None:
            skipped.append((a["id"], "no class subject"))
            continue
        period_id = look.period(t, a["id"], year, a["due_date"], a["assigned_date"])
        category_id = look.category(t, cs, year, "assignment", "homework")
        if period_id is None or category_id is None:
            skipped.append((a["id"], "no period" if period_id is None else "no assignment category"))
            continue
        if a["max_score"] is None or a["max_score"] <= 0:
            skipped.append((a["id"], "max score not positive"))
            continue
        values.append({
            "id": a["id"], "tenant_id": t, "title": a["title"], "description": a["description"],
            "type": "ASSIGNMENT", "subject_id": a["subject_id"], "teacher_id": a["teacher_id"],
            "academic_year_id": year, "grade_id": cs["grade_id"], "section_id": cs["section_id"],
            "class_id": cs["class_id"], "grading_category_id": category_id,
            "assessment_date": a["assigned_date"] or a["due_date"], "max_score": a["max_score"],
            "created_at": a["created_at"], "updated_at": a["updated_at"], "class_subject_id": cs["id"],
            "kind": "assignment", "period_id": period_id, "semester_id": None, "due_date": a["due_date"],
        })
    _insert_assessments(bind, values)
    print(f"{TAG} assignments -> assessments: {len(values)} moved")
    _report("assignments", skipped, "not matched")


def _migrate_exams(bind, look):
    values, skipped, taken = [], [], set()
    for e in _rows(bind, "SELECT * FROM exams ORDER BY exam_date, created_at"):
        t, year = e["tenant_id"], e["academic_year_id"]
        cs = look.class_subject(t, e["subject_id"], None, year, e["grade_id"], e["section_id"])
        semester_id = look.semester(t, year, e["exam_date"])
        if cs is None or semester_id is None:
            skipped.append((e["id"], "no class subject" if cs is None else "no semester"))
            continue
        if (cs["id"], semester_id) in taken:
            skipped.append((e["id"], "second exam for the class subject and semester"))
            continue
        if e["max_score"] is None or e["max_score"] <= 0:
            skipped.append((e["id"], "max score not positive"))
            continue
        taken.add((cs["id"], semester_id))
        values.append({
            "id": e["id"], "tenant_id": t, "title": e["title"], "description": e["description"],
            "type": "EXAM", "subject_id": e["subject_id"], "teacher_id": e["teacher_id"],
            "academic_year_id": year, "grade_id": cs["grade_id"], "section_id": cs["section_id"],
            "class_id": cs["class_id"], "grading_category_id": None, "assessment_date": e["exam_date"],
            "max_score": e["max_score"], "created_at": e["created_at"], "updated_at": e["updated_at"],
            "class_subject_id": cs["id"], "kind": "exam", "period_id": None, "semester_id": semester_id,
            "due_date": None,
        })
    _insert_assessments(bind, values)
    print(f"{TAG} exams -> assessments: {len(values)} moved")
    _report("exams", skipped, "not matched")


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    # 1. assessments: new columns (constraints after the data is in)
    op.add_column('assessments', sa.Column('class_subject_id', UUID(as_uuid=True), nullable=True))
    op.add_column('assessments', sa.Column('kind', sa.String(20), nullable=True))
    op.add_column('assessments', sa.Column('period_id', UUID(as_uuid=True), nullable=True))
    op.add_column('assessments', sa.Column('semester_id', UUID(as_uuid=True), nullable=True))
    op.add_column('assessments', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('assessments', sa.Column('created_by', UUID(as_uuid=True), nullable=True))
    op.create_unique_constraint('uq_tn_assessments', 'assessments', ['tenant_id', 'id'])

    look = _Lookup(bind)
    unplaced = _migrate_assessments(bind, look)
    if unplaced:
        _report("assessments", unplaced, "moved to assessments_unmigrated")
        op.execute("CREATE TABLE assessments_unmigrated (LIKE assessments INCLUDING DEFAULTS)")
        _enable_rls("assessments_unmigrated")
        ids = [str(i) for i, _ in unplaced]
        bind.execute(sa.text("INSERT INTO assessments_unmigrated SELECT * FROM assessments WHERE id::text = ANY(:ids)"), {"ids": ids})
        bind.execute(sa.text("DELETE FROM assessments WHERE id::text = ANY(:ids)"), {"ids": ids})

    # 2. exams and assignments -> assessments
    _migrate_assignments(bind, look)
    _migrate_exams(bind, look)

    # 1b. enforce
    op.alter_column('assessments', 'class_subject_id', nullable=False)
    op.alter_column('assessments', 'kind', nullable=False)
    op.create_check_constraint('ck_assessments_kind', 'assessments', "kind IN ('" + "', '".join(KINDS) + "')")
    op.create_check_constraint('ck_assessments_max_score_positive', 'assessments', 'max_score > 0')
    op.create_check_constraint('ck_assessments_kind_columns', 'assessments', """
        (kind = 'exam' AND semester_id IS NOT NULL AND period_id IS NULL AND grading_category_id IS NULL)
        OR (kind <> 'exam' AND period_id IS NOT NULL AND semester_id IS NULL AND grading_category_id IS NOT NULL)
    """)
    op.create_foreign_key('fk_tn_assessments_class_subject_id', 'assessments', 'class_subjects',
                          ['tenant_id', 'class_subject_id'], ['tenant_id', 'id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_tn_assessments_period_id', 'assessments', 'periods',
                          ['tenant_id', 'period_id'], ['tenant_id', 'id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_tn_assessments_semester_id', 'assessments', 'semesters',
                          ['tenant_id', 'semester_id'], ['tenant_id', 'id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_assessments_created_by', 'assessments', 'users', ['created_by'], ['id'])
    op.create_index('ix_assessments_class_subject_period', 'assessments', ['tenant_id', 'class_subject_id', 'period_id'])
    op.create_index('uq_assessments_one_exam', 'assessments', ['tenant_id', 'class_subject_id', 'semester_id'],
                    unique=True, postgresql_where=sa.text("kind = 'exam'"))

    # 3. new tables
    op.create_table(
        'score_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('assessment_id', UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', UUID(as_uuid=True), nullable=False),
        sa.Column('enrollment_id', UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Numeric(), nullable=True),
        sa.Column('status', sa.String(10), nullable=False, server_default='scored'),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('entered_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('entered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_score_entries'),
        sa.UniqueConstraint('assessment_id', 'student_id', name='uq_score_entries_assessment_student'),
        sa.ForeignKeyConstraint(['tenant_id', 'assessment_id'], ['assessments.tenant_id', 'assessments.id'],
                                name='fk_tn_score_entries_assessment_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id', 'student_id'], ['students.tenant_id', 'students.id'],
                                name='fk_tn_score_entries_student_id'),
        sa.ForeignKeyConstraint(['tenant_id', 'enrollment_id'], ['enrollments.tenant_id', 'enrollments.id'],
                                name='fk_tn_score_entries_enrollment_id'),
        sa.CheckConstraint("status IN ('scored', 'absent', 'excused')", name='ck_score_entries_status'),
        sa.CheckConstraint("(status = 'scored' AND score IS NOT NULL AND score >= 0) "
                           "OR (status <> 'scored' AND score IS NULL)", name='ck_score_entries_score'),
    )
    op.create_index('ix_score_entries_tenant_id', 'score_entries', ['tenant_id'])
    op.create_index('ix_score_entries_tenant_student', 'score_entries', ['tenant_id', 'student_id'])
    _enable_rls('score_entries')

    op.create_table(
        'result_publications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('class_id', UUID(as_uuid=True), nullable=False),
        sa.Column('period_id', UUID(as_uuid=True), nullable=True),
        sa.Column('semester_id', UUID(as_uuid=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('published_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_result_publications'),
        sa.UniqueConstraint('tenant_id', 'class_id', 'period_id', name='uq_result_publications_class_period'),
        sa.UniqueConstraint('tenant_id', 'class_id', 'semester_id', name='uq_result_publications_class_semester'),
        sa.ForeignKeyConstraint(['tenant_id', 'class_id'], ['classes.tenant_id', 'classes.id'],
                                name='fk_tn_result_publications_class_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id', 'period_id'], ['periods.tenant_id', 'periods.id'],
                                name='fk_tn_result_publications_period_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id', 'semester_id'], ['semesters.tenant_id', 'semesters.id'],
                                name='fk_tn_result_publications_semester_id', ondelete='CASCADE'),
        sa.CheckConstraint("(period_id IS NULL) <> (semester_id IS NULL)", name='ck_result_publications_one_column'),
    )
    op.create_index('ix_result_publications_tenant_id', 'result_publications', ['tenant_id'])
    _enable_rls('result_publications')

    op.create_table(
        'grading_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('pass_mark', sa.Integer(), nullable=False, server_default='70'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', name='uq_grading_settings_tenant'),
        sa.UniqueConstraint('tenant_id', 'id', name='uq_tn_grading_settings'),
        sa.CheckConstraint('pass_mark BETWEEN 0 AND 100', name='ck_grading_settings_pass_mark'),
    )
    _enable_rls('grading_settings')

    # 4. grades -> score_entries (latest row per assessment and student)
    total_grades = bind.execute(sa.text("SELECT count(*) FROM grades")).scalar()
    moved = bind.execute(sa.text("""
        INSERT INTO score_entries (id, tenant_id, assessment_id, student_id, enrollment_id, score, status,
                                   comment, entered_by, entered_at, created_at, updated_at)
        SELECT gen_random_uuid(), g.tenant_id, g.assessment_id, g.student_id, g.enrollment_id,
               GREATEST(g.score, 0), 'scored', g.comments, g.graded_by, g.created_at, g.created_at, g.updated_at
        FROM (
            SELECT DISTINCT ON (g.tenant_id, g.assessment_id, g.student_id) g.*
            FROM grades g
            JOIN assessments a ON a.id = g.assessment_id AND a.tenant_id = g.tenant_id
            ORDER BY g.tenant_id, g.assessment_id, g.student_id, g.updated_at DESC, g.created_at DESC
        ) g
    """)).rowcount
    print(f"{TAG} grades -> score_entries: {moved} of {total_grades} moved")
    lost = _rows(bind, """
        SELECT g.id FROM grades g
        WHERE NOT EXISTS (SELECT 1 FROM assessments a WHERE a.id = g.assessment_id AND a.tenant_id = g.tenant_id)
    """)
    _report("grades", [r["id"] for r in lost], "assessment not found")
    over = bind.execute(sa.text("""
        SELECT count(*) FROM score_entries s JOIN assessments a ON a.id = s.assessment_id
        WHERE s.score > a.max_score
    """)).scalar()
    if over:
        print(f"{TAG} note: {over} moved marks are above their assessment's max score (kept as recorded)")

    # 5. publications
    periods = bind.execute(sa.text("""
        INSERT INTO result_publications (id, tenant_id, class_id, period_id, published_at)
        SELECT gen_random_uuid(), p.tenant_id, c.id, p.id, now()
        FROM periods p
        JOIN semesters s ON s.id = p.semester_id AND s.tenant_id = p.tenant_id
        JOIN classes c ON c.tenant_id = p.tenant_id AND c.academic_year_id = s.academic_year_id
        WHERE p.is_published = true
    """)).rowcount
    semesters = bind.execute(sa.text("""
        INSERT INTO result_publications (id, tenant_id, class_id, semester_id, published_at)
        SELECT gen_random_uuid(), s.tenant_id, c.id, s.id, now()
        FROM semesters s
        JOIN classes c ON c.tenant_id = s.tenant_id AND c.academic_year_id = s.academic_year_id
        WHERE s.is_published = true
          AND EXISTS (SELECT 1 FROM periods p WHERE p.semester_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM periods p WHERE p.semester_id = s.id AND p.is_published IS NOT TRUE)
    """)).rowcount
    print(f"{TAG} publications: {periods} class periods, {semesters} class semesters")
    held = _rows(bind, """
        SELECT s.id FROM semesters s
        WHERE s.is_published = true
          AND (NOT EXISTS (SELECT 1 FROM periods p WHERE p.semester_id = s.id)
               OR EXISTS (SELECT 1 FROM periods p WHERE p.semester_id = s.id AND p.is_published IS NOT TRUE))
    """)
    _report("semester publications", [r["id"] for r in held], "not all of the semester's periods are published")

    # 6. fake promotion decisions
    deleted = bind.execute(sa.text(
        "DELETE FROM promotion_status WHERE status = 'Repeating' AND notes = 'No grades recorded'"
    )).rowcount
    print(f"{TAG} promotion statuses 'Repeating / No grades recorded' deleted: {deleted}")

    # 7. permissions
    bind.execute(sa.text("""
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        SELECT :id, 'publish_results', 'Publish and unpublish period and semester results', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'publish_results')
    """), {"id": uuid.uuid4()})
    bind.execute(sa.text("""
        INSERT INTO permission_role (permission_id, role_id)
        SELECT p.id, r.id FROM permissions p, user_roles r
        WHERE p.name = 'publish_results' AND r.name IN ('admin', 'academic-admin') AND r.tenant_id IS NULL
        ON CONFLICT DO NOTHING
    """))
    bind.execute(sa.text("""
        DELETE FROM permission_role
        WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'view_academic_data')
          AND role_id IN (SELECT id FROM user_roles WHERE name = 'teacher' AND tenant_id IS NULL)
    """))


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    bind.execute(sa.text("""
        INSERT INTO permission_role (permission_id, role_id)
        SELECT p.id, r.id FROM permissions p, user_roles r
        WHERE p.name = 'view_academic_data' AND r.name = 'teacher' AND r.tenant_id IS NULL
        ON CONFLICT DO NOTHING
    """))
    bind.execute(sa.text("DELETE FROM permission_role WHERE permission_id IN "
                         "(SELECT id FROM permissions WHERE name = 'publish_results')"))
    bind.execute(sa.text("DELETE FROM permissions WHERE name = 'publish_results'"))

    op.drop_table('grading_settings')
    op.drop_table('result_publications')
    op.drop_table('score_entries')

    # Assessments that came from exams/assignments go; the old tables still hold them
    bind.execute(sa.text("DELETE FROM assessments WHERE id IN (SELECT id FROM assignments) "
                         "OR id IN (SELECT id FROM exams)"))

    op.drop_index('uq_assessments_one_exam', table_name='assessments')
    op.drop_index('ix_assessments_class_subject_period', table_name='assessments')
    op.drop_constraint('fk_assessments_created_by', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_tn_assessments_semester_id', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_tn_assessments_period_id', 'assessments', type_='foreignkey')
    op.drop_constraint('fk_tn_assessments_class_subject_id', 'assessments', type_='foreignkey')
    op.drop_constraint('ck_assessments_kind_columns', 'assessments', type_='check')
    op.drop_constraint('ck_assessments_max_score_positive', 'assessments', type_='check')
    op.drop_constraint('ck_assessments_kind', 'assessments', type_='check')
    op.drop_constraint('uq_tn_assessments', 'assessments', type_='unique')
    for column in ('created_by', 'due_date', 'semester_id', 'period_id', 'kind', 'class_subject_id'):
        op.drop_column('assessments', column)

    exists = bind.execute(sa.text("SELECT to_regclass('assessments_unmigrated') IS NOT NULL")).scalar()
    if exists:
        cols = ("title, description, type, subject_id, teacher_id, academic_year_id, grade_id, section_id, "
                "assessment_date, max_score, is_published, id, created_at, updated_at, tenant_id, class_id, "
                "grading_category_id")
        bind.execute(sa.text(f"INSERT INTO assessments ({cols}) SELECT {cols} FROM assessments_unmigrated"))
        op.drop_table('assessments_unmigrated')
