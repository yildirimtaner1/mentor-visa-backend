from dotenv import load_dotenv
load_dotenv()

import database
import db_models
from sqlalchemy.orm import Session

db = next(database.get_db())

users = db.query(db_models.UserAccount).all()
if not users:
    print("No users found in the database. Cannot grant credits.")
else:
    for u in users:
        u.find_noc_credits += 5
        u.audit_letter_credits += 5
    db.commit()
    for u in users:
        print(f"Granted 5 credits to {u.user_id}. New balance: NOC={u.find_noc_credits}, Audit={u.audit_letter_credits}")
