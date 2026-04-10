from datetime import date, datetime
from typing import Any, Optional
import re

def parse_lenient_date(v: Any) -> Optional[date]:
    """
    Attempt to parse a date from various formats including DD/MM/YYYY.
    Returns a date object if successful, otherwise returns the input value 
    to let Pydantic handle the final validation or error.
    """
    if v is None or v == "":
        return None
    if isinstance(v, date):
        if isinstance(v, datetime):
            return v.date()
        return v
    
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
            
        # 1. Try DD/MM/YYYY or D/M/YY or DD-MM-YYYY
        # This matches common spreadsheet and European formats
        match_slash = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$', v)
        if match_slash:
            try:
                d, m, y = map(int, match_slash.groups())
                # Handle 2-digit year (assume 20xx)
                if y < 100:
                    y += 2000
                return date(y, m, d)
            except ValueError:
                pass # If it's something like 99/99/99, let it fall through
        
        # 2. Try ISO format (YYYY-MM-DD)
        try:
            # date.fromisoformat only handles YYYY-MM-DD in Python < 3.11
            # In 3.11+ it's more lenient, but we want to be explicit
            return date.fromisoformat(v)
        except ValueError:
            pass
            
        # 3. Try generic datetime string (YYYY-MM-DD HH:MM:SS)
        try:
            # Standard ISO datetime strings sometimes have space instead of T
            clean_v = v.replace(' ', 'T')
            return datetime.fromisoformat(clean_v).date()
        except ValueError:
            pass
            
    return v
