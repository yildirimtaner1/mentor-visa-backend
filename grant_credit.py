
import sys
from database import SessionLocal
from db_models import UserAccount

db = SessionLocal()
user_id = 'user_3CFPC1lpFTtSJF3jmMjuGmQCS3j'
user = db.query(UserAccount).filter_by(user_id=user_id).first()

if not user:
    user = UserAccount(user_id=user_id, find_noc_credits=0, audit_letter_credits=0)
    db.add(user)
    print('User created.')

user.audit_letter_credits += 1
db.commit()
print(f'Done! User now has {user.audit_letter_credits} audit credits and {user.find_noc_credits} NOC credits.')

