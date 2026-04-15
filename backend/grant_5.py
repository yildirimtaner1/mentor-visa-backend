from dotenv import load_dotenv
load_dotenv()
from database import SessionLocal
import db_models

USER_ID = "user_3C6faz9egcUfUPYka6usKCCAuti"

db = SessionLocal()
user = db.query(db_models.UserAccount).filter_by(user_id=USER_ID).first()

if not user:
    user = db_models.UserAccount(user_id=USER_ID, find_noc_credits=0, audit_letter_credits=0)
    db.add(user)
    print("Created new user account")

user.find_noc_credits += 5
user.audit_letter_credits += 5
db.commit()

print(f"Done! Credits for {USER_ID}:")
print(f"  NOC Finder: {user.find_noc_credits}")
print(f"  Audit Letter: {user.audit_letter_credits}")
db.close()
