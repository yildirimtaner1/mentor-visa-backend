import traceback
import sys

try:
    from database import SessionLocal
    from main import get_evaluations

    db = SessionLocal()
    # Provide a dummy user_id or use "test_user" which was failing foreign key
    # Wait, the user might be accessing it as themselves. I can just query for ANY user.
    out = get_evaluations(user_id="test_user", db=db)
    print("Success for test_user:", len(out["evaluations"]))
    
    # Actually, we should check what user_id they actually log in with...
    # But let's check any user that exists.
    from db_models import Evaluation
    some_eval = db.query(Evaluation).first()
    if some_eval:
        real_user = some_eval.user_id
        out2 = get_evaluations(user_id=real_user, db=db)
        print("Success for real_user:", len(out2["evaluations"]))
    else:
        print("No evaluations in DB.")

except Exception as e:
    traceback.print_exc()
