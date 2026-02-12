"""
Add unique constraint and index for enrollments; backfill academic_year_id and de-duplicate.

Revision ID: e61a8f2b9ba0
Revises: d3474a46324b
Create Date: 2025-11-18 10:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "e61a8f2b9ba0"
down_revision = "d3474a46324b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "enrollments" not in insp.get_table_names():
        # Nothing to do if enrollments table doesn't exist
        return

    # 1) Backfill academic_year_id from legacy academic_year name, scoped by tenant_id
    enroll_cols = {c["name"] for c in insp.get_columns("enrollments")}
    if "academic_year_id" in enroll_cols and "academic_year" in enroll_cols:
        bind.execute(
            text(
                """
                UPDATE enrollments e
                SET academic_year_id = ay.id
                FROM academic_years ay
                WHERE e.academic_year_id IS NULL
                  AND e.academic_year IS NOT NULL
                  AND ay.name = e.academic_year
                  AND ay.tenant_id = e.tenant_id
                """
            )
        )

    # 2) De-duplicate rows for same tenant_id + student_id + academic_year_id
    #    Keep: active first, status 'active' next, then newest by updated_at/created_at
    duplicates_count = bind.execute(
        text(
            """
            SELECT COUNT(*) FROM (
              SELECT tenant_id, student_id, academic_year_id, COUNT(*) AS cnt
              FROM enrollments
              WHERE academic_year_id IS NOT NULL
              GROUP BY tenant_id, student_id, academic_year_id
              HAVING COUNT(*) > 1
            ) s
            """
        )
    ).scalar()

    if duplicates_count and duplicates_count > 0:
        # Delete lower-priority duplicates, keep the "best" one per grouping
        bind.execute(
            text(
                """
                DELETE FROM enrollments e
                USING (
                  SELECT id,
                         row_number() OVER (
                           PARTITION BY tenant_id, student_id, academic_year_id
                           ORDER BY
                             CASE WHEN is_active THEN 1 ELSE 0 END DESC,
                             CASE WHEN status = 'active' THEN 1 ELSE 0 END DESC,
                             updated_at DESC NULLS LAST,
                             created_at DESC NULLS LAST
                         ) AS rn
                  FROM enrollments
                  WHERE academic_year_id IS NOT NULL
                ) d
                WHERE e.id = d.id
                  AND d.rn > 1
                """
            )
        )

    # 3) Tighten academic_year_id to NOT NULL only if safe (no NULLs remain)
    nulls_remaining = bind.execute(
        text("SELECT COUNT(*) FROM enrollments WHERE academic_year_id IS NULL")
    ).scalar()
    if nulls_remaining == 0:
        # Only alter if currently nullable (guarded by inspector)
        e_cols = {c["name"]: c for c in insp.get_columns("enrollments")}
        if e_cols.get("academic_year_id", {}).get("nullable", True):
            op.alter_column(
                "enrollments",
                "academic_year_id",
                existing_type=sa.UUID(),
                nullable=False,
            )

    # 4) Create unique constraint if missing
    existing_uniques = {uc["name"] for uc in insp.get_unique_constraints("enrollments")}
    if "unique_enrollment_student_year" not in existing_uniques:
        op.create_unique_constraint(
            "unique_enrollment_student_year",
            "enrollments",
            ["tenant_id", "student_id", "academic_year_id"],
        )

    # 5) Create support index for fast active lookups if missing
    existing_indexes = {idx["name"] for idx in insp.get_indexes("enrollments")}
    if "ix_enrollments_active_student" not in existing_indexes:
        op.create_index(
            "ix_enrollments_active_student",
            "enrollments",
            ["tenant_id", "student_id", "is_active", "status"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "enrollments" not in insp.get_table_names():
        return

    # Drop index if exists
    existing_indexes = {idx["name"] for idx in insp.get_indexes("enrollments")}
    if "ix_enrollments_active_student" in existing_indexes:
        op.drop_index("ix_enrollments_active_student", table_name="enrollments")

    # Drop unique constraint if exists
    existing_uniques = {uc["name"] for uc in insp.get_unique_constraints("enrollments")}
    if "unique_enrollment_student_year" in existing_uniques:
        op.drop_constraint(
            "unique_enrollment_student_year", "enrollments", type_="unique"
        )

    # Relax academic_year_id to nullable (safe default on downgrade)
    e_cols = {c["name"]: c for c in insp.get_columns("enrollments")}
    if "academic_year_id" in e_cols and not e_cols["academic_year_id"].get("nullable", True):
        op.alter_column(
            "enrollments",
            "academic_year_id",
            existing_type=sa.UUID(),
            nullable=True,
        )