from src.db.session import SessionLocal
from src.db.models.tenant import Tenant
from src.db.models.auth import User

db = SessionLocal()

with open("dump_utf8.txt", "w", encoding="utf-8") as f:
    f.write("TENANTS:\n")
    tenants = db.query(Tenant).all()
    for t in tenants:
        f.write(f"ID: {t.id}\n")
        f.write(f"Name: {t.name}\n")
        f.write(f"Code: {t.code}\n")
        f.write(f"Domain: {t.domain}\n")
        f.write(f"Subdomain: {t.subdomain}\n")
        f.write("-" * 20 + "\n")
        
    f.write("\nUSERS:\n")
    users = db.query(User).filter(User.email.in_(["jarboi@mail.com", "paul@topfoundation.com", "superadmin@example.com"])).all()
    for u in users:
        f.write(f"ID: {u.id}\n")
        f.write(f"Email: {u.email}\n")
        f.write(f"Tenant ID: {u.tenant_id}\n")
        f.write(f"Name: {u.first_name} {u.last_name}\n")
        f.write("-" * 20 + "\n")
