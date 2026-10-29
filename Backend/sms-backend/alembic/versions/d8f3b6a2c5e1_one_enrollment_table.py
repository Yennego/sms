"""
one_enrollment_table

One enrollment table (docs/remodel/05-schema-plan.md §5): `class_enrollments` is folded into
`enrollments`, which gets `class_id`. A student has one enrollment per school year, and that
enrollment names its class; its year, grade and section are the class's.

Steps:
1. classes: add the class identity rule UNIQUE (tenant_id, academic_year_id, grade_id,
   section_id) `unique_class_identity` (declared by the model, missing in the database).
   Fails with the list of duplicates if two classes share an identity.
2. enrollments.class_id (nullable for now).
3. class_enrollments rows with no enrollment for that student and year become enrollments.
4. Backfill class_id: first from class_enrollments (same student and year, class with the
   same grade and section), then from the class with the same school/year/grade/section;
   classes still missing are created ("<grade> - <section>"), so every enrollment has one.
5. Carry over class_enrollments data: drop/completion date -> withdrawal_date (when the
   enrollment has none), enrollment_date when missing.
6. class_id NOT NULL; classes UNIQUE (tenant_id, id, academic_year_id, grade_id, section_id)
   and a composite FK from enrollments to it, so an enrollment's year/grade/section always
   equal its class's (ON DELETE RESTRICT; ON UPDATE CASCADE so editing a class's grade or
   section moves its enrollments with it).
7. Drop class_enrollments.

Downgrade recreates class_enrollments (with its row level security policy) from enrollments.
Classes created in step 4 are kept.

Revision ID: d8f3b6a2c5e1
Revises: c4e7a2b9d1f5
Create Date: 2026-10-28 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd8f3b6a2c5e1'
down_revision = 'c4e7a2b9d1f5'
branch_labels = None
depends_on = None

RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)


def _bypass_rls(bind):
    # The tables FORCE row level security; a non-superuser owner must opt out explicitly.
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _scalar(bind, sql):
    return bind.execute(sa.text(sql)).scalar()


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    # 1. Class identity rule
    dupes = bind.execute(sa.text("""
        SELECT tenant_id, academic_year_id, grade_id, section_id, count(*) AS n,
               string_agg(id::text, ', ') AS ids
        FROM classes
        GROUP BY tenant_id, academic_year_id, grade_id, section_id
        HAVING count(*) > 1
    """)).fetchall()
    if dupes:
        lines = "\n".join(
            f"  school {d.tenant_id} year {d.academic_year_id} grade {d.grade_id} "
            f"section {d.section_id}: {d.n} classes ({d.ids})"
            for d in dupes
        )
        raise RuntimeError(
            "Cannot add unique_class_identity: these classes share a school/year/grade/section. "
            "Merge or delete the extra classes, then run the migration again.\n" + lines
        )
    op.create_unique_constraint(
        'unique_class_identity', 'classes',
        ['tenant_id', 'academic_year_id', 'grade_id', 'section_id'],
    )

    # 2. enrollments.class_id
    op.add_column('enrollments', sa.Column('class_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))

    # One class_enrollments row per (school, student, year): active first, then most recent.
    picked = """
        SELECT DISTINCT ON (ce.tenant_id, ce.student_id, ce.academic_year_id) ce.*
        FROM class_enrollments ce
        ORDER BY ce.tenant_id, ce.student_id, ce.academic_year_id,
                 ce.is_active DESC, ce.updated_at DESC, ce.created_at DESC
    """
    extra = _scalar(bind, f"SELECT (SELECT count(*) FROM class_enrollments) - (SELECT count(*) FROM ({picked}) p)")
    if extra:
        print(f"[one_enrollment_table] {extra} class_enrollments rows are extra classes for a "
              "student and year already covered; the active/most recent one is used.")

    # 3. class_enrollments without an enrollment become enrollments
    created = bind.execute(sa.text(f"""
        INSERT INTO enrollments (
            id, tenant_id, student_id, academic_year_id, grade_id, section_id, class_id,
            academic_year, grade, section,
            semester, enrollment_date, status, is_active, withdrawal_date,
            semester_1_status, semester_2_status, created_at, updated_at
        )
        SELECT gen_random_uuid(), p.tenant_id, p.student_id, p.academic_year_id, c.grade_id, c.section_id, c.id,
               ay.name, g.name, s.name,
               1, p.enrollment_date,
               CASE p.status WHEN 'dropped' THEN 'withdrawn' ELSE p.status END,
               p.is_active, COALESCE(p.drop_date, p.completion_date),
               'pending', 'pending', p.created_at, p.updated_at
        FROM ({picked}) p
        JOIN classes c ON c.id = p.class_id AND c.tenant_id = p.tenant_id
        LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
        LEFT JOIN academic_grades g ON g.id = c.grade_id
        LEFT JOIN sections s ON s.id = c.section_id
        WHERE c.academic_year_id = p.academic_year_id
          AND NOT EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.tenant_id = p.tenant_id AND e.student_id = p.student_id
              AND e.academic_year_id = p.academic_year_id
          )
    """)).rowcount
    if created:
        print(f"[one_enrollment_table] created {created} enrollments from class_enrollments rows that had none.")

    # 4a. class from class_enrollments (only when it agrees with the enrollment's grade/section)
    bind.execute(sa.text(f"""
        UPDATE enrollments e SET class_id = c.id
        FROM ({picked}) p
        JOIN classes c ON c.id = p.class_id AND c.tenant_id = p.tenant_id
        WHERE e.class_id IS NULL
          AND p.tenant_id = e.tenant_id AND p.student_id = e.student_id
          AND p.academic_year_id = e.academic_year_id
          AND c.academic_year_id = e.academic_year_id
          AND c.grade_id = e.grade_id AND c.section_id = e.section_id
    """))
    conflicts = _scalar(bind, f"""
        SELECT count(*) FROM enrollments e
        JOIN ({picked}) p ON p.tenant_id = e.tenant_id AND p.student_id = e.student_id
                         AND p.academic_year_id = e.academic_year_id
        WHERE e.class_id IS NULL
    """)
    if conflicts:
        print(f"[one_enrollment_table] {conflicts} class_enrollments rows name a class whose grade/section "
              "differs from the enrollment; the enrollment's grade/section is kept.")

    # 4b. class with the same school/year/grade/section
    by_identity = """
        UPDATE enrollments e SET class_id = c.id
        FROM classes c
        WHERE e.class_id IS NULL
          AND c.tenant_id = e.tenant_id AND c.academic_year_id = e.academic_year_id
          AND c.grade_id = e.grade_id AND c.section_id = e.section_id
    """
    bind.execute(sa.text(by_identity))

    # 4c. create the classes that are still missing (model defaults: capacity 30, active,
    # starts today)
    new_classes = bind.execute(sa.text("""
        INSERT INTO classes (id, tenant_id, name, academic_year_id, grade_id, section_id,
                             capacity, is_active, start_date, created_at, updated_at)
        SELECT gen_random_uuid(), x.tenant_id, g.name || ' - ' || s.name,
               x.academic_year_id, x.grade_id, x.section_id,
               30, true, current_date, now(), now()
        FROM (SELECT DISTINCT tenant_id, academic_year_id, grade_id, section_id
              FROM enrollments WHERE class_id IS NULL) x
        JOIN academic_grades g ON g.id = x.grade_id
        JOIN sections s ON s.id = x.section_id
    """)).rowcount
    if new_classes:
        print(f"[one_enrollment_table] created {new_classes} classes for enrollments that had none.")
        bind.execute(sa.text(by_identity))

    missing = _scalar(bind, "SELECT count(*) FROM enrollments WHERE class_id IS NULL")
    if missing:
        raise RuntimeError(f"{missing} enrollments still have no class (grade or section row missing?)")

    # 5. carry over class_enrollments data
    bind.execute(sa.text("""
        UPDATE enrollments e
        SET withdrawal_date = COALESCE(e.withdrawal_date, ce.drop_date, ce.completion_date),
            enrollment_date = COALESCE(e.enrollment_date, ce.enrollment_date)
        FROM class_enrollments ce
        WHERE ce.tenant_id = e.tenant_id AND ce.student_id = e.student_id
          AND ce.academic_year_id = e.academic_year_id AND ce.class_id = e.class_id
          AND ((e.withdrawal_date IS NULL AND COALESCE(ce.drop_date, ce.completion_date) IS NOT NULL)
               OR e.enrollment_date IS NULL)
    """))

    # 6. enforce
    op.alter_column('enrollments', 'class_id', nullable=False)
    op.create_unique_constraint(
        'uq_tn_classes_enrollment_target', 'classes',
        ['tenant_id', 'id', 'academic_year_id', 'grade_id', 'section_id'],
    )
    op.create_foreign_key(
        'fk_tn_enrollments_class_id', 'enrollments', 'classes',
        ['tenant_id', 'class_id', 'academic_year_id', 'grade_id', 'section_id'],
        ['tenant_id', 'id', 'academic_year_id', 'grade_id', 'section_id'],
        ondelete='RESTRICT', onupdate='CASCADE',
    )
    op.create_index('ix_enrollments_tenant_class', 'enrollments', ['tenant_id', 'class_id'])

    # 7. one table
    op.drop_table('class_enrollments')


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    op.execute("""
        CREATE TABLE class_enrollments (
            student_id uuid NOT NULL,
            class_id uuid NOT NULL,
            academic_year_id uuid NOT NULL,
            enrollment_date date NOT NULL,
            status character varying(20) NOT NULL,
            is_active boolean NOT NULL,
            drop_date date,
            completion_date date,
            id uuid NOT NULL,
            created_at timestamp with time zone NOT NULL,
            updated_at timestamp with time zone NOT NULL,
            tenant_id uuid NOT NULL,
            CONSTRAINT class_enrollments_pkey PRIMARY KEY (id),
            CONSTRAINT unique_student_class_year UNIQUE (student_id, class_id, academic_year_id),
            CONSTRAINT fk_tn_class_enrollments_academic_year_id FOREIGN KEY (tenant_id, academic_year_id)
                REFERENCES academic_years(tenant_id, id),
            CONSTRAINT fk_tn_class_enrollments_class_id FOREIGN KEY (tenant_id, class_id)
                REFERENCES classes(tenant_id, id),
            CONSTRAINT fk_tn_class_enrollments_student_id FOREIGN KEY (tenant_id, student_id)
                REFERENCES students(tenant_id, id),
            CONSTRAINT fk_tn_class_enrollments_tenant FOREIGN KEY (tenant_id)
                REFERENCES tenants(id) ON DELETE RESTRICT
        )
    """)
    op.create_index('idx_class_enrollments_class_id', 'class_enrollments', ['class_id'])
    op.create_index('idx_class_enrollments_student_id', 'class_enrollments', ['student_id'])
    op.create_index('ix_class_enrollments_tenant_id', 'class_enrollments', ['tenant_id'])
    op.execute("ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE class_enrollments FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON class_enrollments USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")

    bind.execute(sa.text("""
        INSERT INTO class_enrollments (
            id, tenant_id, student_id, class_id, academic_year_id, enrollment_date,
            status, is_active, drop_date, completion_date, created_at, updated_at
        )
        SELECT gen_random_uuid(), e.tenant_id, e.student_id, e.class_id, e.academic_year_id,
               COALESCE(e.enrollment_date, e.created_at::date),
               x.status, COALESCE(e.is_active, true),
               CASE WHEN x.status = 'dropped' THEN e.withdrawal_date END,
               CASE WHEN x.status = 'completed' THEN e.withdrawal_date END,
               e.created_at, e.updated_at
        FROM enrollments e
        CROSS JOIN LATERAL (SELECT CASE
            WHEN COALESCE(e.status, 'active') = 'active' THEN 'active'
            WHEN e.status IN ('completed', 'graduated', 'promoted') THEN 'completed'
            ELSE 'dropped' END AS status) x
    """))

    op.drop_index('ix_enrollments_tenant_class', table_name='enrollments')
    op.drop_constraint('fk_tn_enrollments_class_id', 'enrollments', type_='foreignkey')
    op.drop_constraint('uq_tn_classes_enrollment_target', 'classes', type_='unique')
    op.drop_column('enrollments', 'class_id')
    op.drop_constraint('unique_class_identity', 'classes', type_='unique')
