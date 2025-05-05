from sqlalchemy import create_engine, text
from src.core.config import settings

# Create engine
engine = create_engine(settings.DATABASE_URL)

# Execute query
with engine.connect() as connection:
    # Check user_role_association table
    print("\nChecking user_role_association table:")
    assoc_query = f"""
    SELECT * FROM user_role_association 
    WHERE user_id = '7894beb3-ac63-4394-991b-fcf2b142f5b8' 
    AND role_id = 'dc831a2b-90ba-4473-86ad-160aafbfa2dc';
    """
    try:
        assoc_result = connection.execute(text(assoc_query))
        rows = assoc_result.fetchall()
        if rows:
            print(f"Found {len(rows)} entries in user_role_association")
            for row in rows:
                print(row)
        else:
            print("No entries found in user_role_association")
    except Exception as e:
        print(f"Error querying user_role_association: {e}")
    
    # Check user_role table
    print("\nChecking user_role table:")
    role_query = f"""
    SELECT * FROM user_role 
    WHERE user_id = '7894beb3-ac63-4394-991b-fcf2b142f5b8' 
    AND role_id = 'dc831a2b-90ba-4473-86ad-160aafbfa2dc';
    """
    try:
        role_result = connection.execute(text(role_query))
        rows = role_result.fetchall()
        if rows:
            print(f"Found {len(rows)} entries in user_role")
            for row in rows:
                print(row)
        else:
            print("No entries found in user_role")
    except Exception as e:
        print(f"Error querying user_role: {e}")
    
    # Check which tables exist
    print("\nChecking which tables exist:")
    tables_query = "SELECT name FROM sqlite_master WHERE type='table';"
    try:
        tables_result = connection.execute(text(tables_query))
        tables = tables_result.fetchall()
        print("Tables in database:")
        for table in tables:
            print(f"- {table[0]}")
    except Exception as e:
        print(f"Error listing tables: {e}")