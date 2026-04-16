import database
from sqlalchemy import text

db = database.SessionLocal()
user_id = 'user_3BeDlZjYenTU1n3ummT7fVT9lr7'

query = f"""
UPDATE users 
SET find_noc_credits = find_noc_credits + 5, 
    audit_letter_credits = audit_letter_credits + 5, 
    letter_builder_credits = letter_builder_credits + 5, 
    ita_strategy_credits = ita_strategy_credits + 5 
WHERE user_id = '{user_id}'
"""
db.execute(text(query))
db.commit()

row = db.execute(text(f"SELECT find_noc_credits, audit_letter_credits, letter_builder_credits, ita_strategy_credits FROM users WHERE user_id = '{user_id}'")).fetchone()
print(f"Credits for {user_id}:")
print(f"  NOC Finder:      {row[0]}")
print(f"  Letter Auditor:  {row[1]}")
print(f"  Letter Builder:  {row[2]}")
print(f"  ITA Strategy:    {row[3]}")
db.close()
