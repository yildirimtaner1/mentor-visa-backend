import database
from sqlalchemy import text

db = database.SessionLocal()
query = """
UPDATE users 
SET find_noc_credits = 0, 
    audit_letter_credits = 0, 
    letter_builder_credits = 0, 
    ita_strategy_credits = 0 
WHERE user_id = 'user_3BeDlZjYenTU1n3ummT7fVT9lr7'
"""
db.execute(text(query))
db.commit()

row = db.execute(text("SELECT find_noc_credits, audit_letter_credits, letter_builder_credits, ita_strategy_credits FROM users WHERE user_id = 'user_3BeDlZjYenTU1n3ummT7fVT9lr7'")).fetchone()
print(list(row))
db.close()
