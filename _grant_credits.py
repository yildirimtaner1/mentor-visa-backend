import database
from sqlalchemy import text

db = database.SessionLocal()
db.execute(text("UPDATE users SET ita_strategy_credits = ita_strategy_credits + 5 WHERE user_id = 'user_3BeDlZjYenTU1n3ummT7fVT9lr7'"))
db.commit()
row = db.execute(text("SELECT user_id, ita_strategy_credits FROM users WHERE user_id = 'user_3BeDlZjYenTU1n3ummT7fVT9lr7'")).fetchone()
print(f"User: {row[0]}, ITA Strategy Credits: {row[1]}")
db.close()
