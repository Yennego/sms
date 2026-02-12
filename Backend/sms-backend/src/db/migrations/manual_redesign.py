import uuid
from datetime import date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database configuration
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:199922@localhost:5432/sms_db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate_classes():
    db = SessionLocal()
    try:
        # 1. Create class_subjects table
        print("Ensuring class_subjects table exists...")
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS class_subjects (
                    id UUID PRIMARY KEY,
                    tenant_id UUID NOT NULL,
                    class_id UUID NOT NULL,
                    subject_id UUID NOT NULL,
                    teacher_id UUID,
                    grading_schema_id UUID,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT unique_class_subject UNIQUE (class_id, subject_id),
                    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
                    FOREIGN KEY (grading_schema_id) REFERENCES grading_schemas(id) ON DELETE SET NULL
                );
            """))
            db.commit()
        except Exception as e:
            print(f"Error creating table: {e}")
            db.rollback()

        # 2. Add columns
        print("Adding new columns to classes...")
        for col in [
            "ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id)",
            "ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES teachers(id)"
        ]:
            try:
                db.execute(text(col))
                db.commit()
            except Exception as e:
                print(f"Error adding column: {e}")
                db.rollback()

        # 3. Fetch data
        print("Fetching classes...")
        classes = db.execute(text("SELECT id, tenant_id, academic_year, grade_id, section_id, subject_id, teacher_id, grading_schema_id FROM classes")).fetchall()
        
        # 4. Map Academic Year names to IDs
        print("Mapping Academic Years...")
        academic_years_raw = db.execute(text("SELECT name, id FROM academic_years")).fetchall()
        # Normalize: replace / with - to match classes table
        ay_map = {row[0].replace('/', '-'): row[1] for row in academic_years_raw}
        print(f"Found academic years (normalized): {list(ay_map.keys())}")

        # 5. Track unique classes (tenant, ay_id, grade, section)
        primary_classes = {} # Key: (tenant_id, ay_id, grade_id, section_id) -> Primary Class ID
        processed_count = 0
        
        for row in classes:
            # Safer unpack
            cid, t_id, ay_name, g_id, s_id, sub_id, teach_id, schema_id = row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]
            print(f"Processing Class: {cid} ({ay_name}, Grade:{g_id}, Section:{s_id})")
            
            # Normalize ay_name for matching
            norm_ay_name = ay_name.strip().replace('/', '-') if ay_name else None
            ay_id = ay_map.get(norm_ay_name)
            
            print(f"  Normalized: '{norm_ay_name}' | Result ID: {ay_id}")
            if not ay_id:
                print(f"  !! Skipping: No ay_id for '{ay_name}' in {list(ay_map.keys())}")
                continue

            # Update the academic_year_id
            db.execute(text("UPDATE classes SET academic_year_id = :ay_id WHERE id = :cid"), {"ay_id": ay_id, "cid": cid})

            key = (t_id, ay_id, g_id, s_id)
            if key not in primary_classes:
                print(f"  -> NEW Primary Class: {cid}")
                primary_classes[key] = cid
                db.execute(text("UPDATE classes SET class_teacher_id = :teach_id WHERE id = :cid"), {"teach_id": teach_id, "cid": cid})
                target_cid = cid
            else:
                target_cid = primary_classes[key]
                print(f"  -> Merging into Primary: {target_cid}")
                
                # Re-link child records
                # ONLY tables that actually have class_id
                child_tables = ["class_enrollments", "schedules"] 
                for table in child_tables:
                    try:
                        # Use a nested transaction (savepoint) for each table update
                        with db.begin_nested():
                            res = db.execute(text(f"UPDATE {table} SET class_id = :target WHERE class_id = :old"), {"target": target_cid, "old": cid})
                            print(f"    - Updated {table}: {res.rowcount} rows")
                    except Exception as e:
                        print(f"    - Skipping relinking for {table}: {e}")

            # Create the ClassSubject entry
            cs_id = uuid.uuid4()
            try:
                db.execute(text("""
                    INSERT INTO class_subjects (id, tenant_id, class_id, subject_id, teacher_id, grading_schema_id)
                    VALUES (:id, :t_id, :c_id, :s_id, :teach_id, :schema_id)
                    ON CONFLICT (class_id, subject_id) DO NOTHING;
                """), {
                    "id": cs_id, "t_id": t_id, "c_id": target_cid, 
                    "s_id": sub_id, "teach_id": teach_id, "schema_id": schema_id
                })
                print(f"    + ClassSubject created for subject: {sub_id}")
            except Exception as e:
                print(f"    + Error creating ClassSubject: {e}")
            
            processed_count += 1

        db.commit()
        print(f"Migration phase 1 (Mapping) completed. Processed {processed_count} classes.")

        # 6. Cleanup duplicates
        print("Cleaning up duplicate classes...")
        deleted_count = 0
        for row in classes:
            cid, t_id, ay_name, g_id, s_id = row[0], row[1], row[2], row[3], row[4]
            norm_ay_name = ay_name.replace('/', '-') if ay_name else None
            ay_id = ay_map.get(norm_ay_name)
            if not ay_id: continue
            
            key = (t_id, ay_id, g_id, s_id)
            if primary_classes[key] != cid:
                db.execute(text("DELETE FROM classes WHERE id = :id"), {"id": cid})
                deleted_count += 1
        
        db.commit()
        print(f"Migration phase 2 (Cleanup) completed. Deleted {deleted_count} duplicate classes.")

        # 7. Drop old columns
        print("Dropping legacy columns from classes table...")
        columns_to_drop = ["academic_year", "subject_id", "teacher_id", "grading_schema_id"]
        for col in columns_to_drop:
            try:
                db.execute(text(f"ALTER TABLE classes DROP COLUMN IF EXISTS {col} CASCADE"))
                db.commit()
                print(f"  - Dropped column: {col}")
            except Exception as e:
                print(f"  - Error dropping column {col}: {e}")
                db.rollback()

        print("MIGRATION_SUCCESS")

    except Exception as e:
        db.rollback()
        print(f"CRITICAL_MIGRATION_ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_classes()
