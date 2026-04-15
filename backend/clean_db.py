from dotenv import load_dotenv
load_dotenv()

import database
import db_models
from sqlalchemy.orm import Session

db = next(database.get_db())

# Delete the corrupted empty records (IDs 89 and 91)
db.query(db_models.NocEvaluationRecord).filter(db_models.NocEvaluationRecord.id.in_([89, 91])).delete()
db.commit()
print("Cleaned up corrupted records.")
