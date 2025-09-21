#!/usr/bin/env python3
"""
Script to fix timetable academic year reference
"""
import os
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from core.config import settings

def fix_timetable_reference():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Update the timetable to reference the correct academic year name
        result = conn.execute(text("""
            UPDATE timetables 
            SET academic_year = 'Academic Year-2024/2025'
            WHERE academic_year = '2024/2025'
            AND tenant_id = '34624041-c24a-4400-a9b7-f692c3f3fba7'
        """))
        
        print(f"Updated {result.rowcount} timetable reference(s)")
        conn.commit()

if __name__ == "__main__":
    fix_timetable_reference()