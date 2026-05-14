import database
import db_models
import sys

def check_user(user_id):
    db = next(database.get_db())
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not user:
        print(f"User {user_id} not found in UserAccount table.")
        return
    
    print(f"User ID: {user.user_id}")
    print(f"Subscription Tier: {user.subscription_tier}")
    print(f"Audit Letter Credits: {user.audit_letter_credits}")
    print(f"Find NOC Credits: {user.find_noc_credits}")
    print(f"Letter Builder Credits: {user.letter_builder_credits}")
    print(f"ITA Strategy Credits: {user.ita_strategy_credits}")
    print(f"Profile Builder Credits: {user.profile_builder_credits}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_user_status.py <user_id>")
        sys.exit(1)
    check_user(sys.argv[1])
