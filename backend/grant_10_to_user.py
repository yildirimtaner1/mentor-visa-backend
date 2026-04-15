from dotenv import load_dotenv
load_dotenv()

import database
import db_models

db = next(database.get_db())

TARGET_USER = "user_3C6faz9egcUfUPYka6usKCCAuti"
user = db.query(db_models.UserAccount).filter(db_models.UserAccount.user_id == TARGET_USER).first()

if user:
    user.audit_letter_credits += 10
    user.find_noc_credits += 10
    db.commit()
    print(f"Granted 10 audit credits & 10 noc credits to {user.user_id}.")
    print(f"New balance: Auditor = {user.audit_letter_credits}, NOC Finder = {user.find_noc_credits}")
else:
    print(f"User {TARGET_USER} not found in database!")
