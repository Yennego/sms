#!/usr/bin/env python3
"""
Script to check timetable and academic year data before migration
"""
import os
import sys
from sqlalchemy import create_engine, text

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from core.config import settings

def check_data():
    # Create database connection
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        print("=== ACADEMIC YEARS ===")
        result = conn.execute(text("SELECT id, name, tenant_id FROM academic_years ORDER BY name"))
        academic_years = result.fetchall()
        print(f"Found {len(academic_years)} academic years:")
        for ay in academic_years:
            print(f"  - {ay.name} (ID: {ay.id}, Tenant: {ay.tenant_id})")
        
        print("\n=== TIMETABLES ===")
        result = conn.execute(text("SELECT id, name, academic_year, tenant_id FROM timetables ORDER BY academic_year"))
        timetables = result.fetchall()
        print(f"Found {len(timetables)} timetables:")
        for tt in timetables:
            print(f"  - {tt.name}: academic_year='{tt.academic_year}' (ID: {tt.id}, Tenant: {tt.tenant_id})")
        
        print("\n=== MISMATCHED DATA ===")
        result = conn.execute(text("""
            SELECT DISTINCT t.academic_year, t.tenant_id
            FROM timetables t
            LEFT JOIN academic_years ay ON t.academic_year = ay.name AND t.tenant_id = ay.tenant_id
            WHERE ay.id IS NULL
            ORDER BY t.tenant_id, t.academic_year
        """))
        mismatched = result.fetchall()
        
        if mismatched:
            print(f"Found {len(mismatched)} mismatched academic_year values:")
            for mm in mismatched:
                print(f"  - Tenant {mm.tenant_id}: '{mm.academic_year}' (no matching academic year)")
        else:
            print("No mismatched data found!")

if __name__ == "__main__":
    check_data()