#!/usr/bin/env python3
"""
Script to fix academic year name mismatch
"""
import os
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from core.config import settings

def fix_academic_year_name():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Update the academic year name to match timetable expectation
        result = conn.execute(text("""
            UPDATE academic_years 
            SET name = '2024/2025'
            WHERE name = 'Academic Year-2024/2025'
            AND tenant_id = '34624041-c24a-4400-a9b7-f692c3f3fba7'
        """))
        
        print(f"Updated {result.rowcount} academic year name(s)")
        conn.commit()
        
        # Verify the fix
        result = conn.execute(text("""
            SELECT t.academic_year, ay.name as academic_year_name
            FROM timetables t
            LEFT JOIN academic_years ay ON t.academic_year = ay.name AND t.tenant_id = ay.tenant_id
            WHERE t.tenant_id = '34624041-c24a-4400-a9b7-f692c3f3fba7'
        """))
        
        matches = result.fetchall()
        print("\nVerification:")
        for match in matches:
            if match.academic_year_name:
                print(f"  ✓ Timetable '{match.academic_year}' matches academic year '{match.academic_year_name}'")
            else:
                print(f"  ✗ Timetable '{match.academic_year}' has no matching academic year")

if __name__ == "__main__":
    fix_academic_year_name()