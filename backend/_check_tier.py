from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlalchemy import text

USER_ID = "user_3BeDlZjYenTU1n3ummT7fVT9lr7"

with engine.connect() as conn:
    # Check pr_journeys
    row = conn.execute(
        text("SELECT id, subscription_tier FROM pr_journeys WHERE user_id = :uid"),
        {"uid": USER_ID}
    ).fetchone()
    if row:
        print(f"pr_journeys: id={row[0]}, tier={row[1]}")
    else:
        print("pr_journeys: NO ROW FOUND for this user")

    # Check users
    row2 = conn.execute(
        text("SELECT subscription_tier FROM users WHERE user_id = :uid"),
        {"uid": USER_ID}
    ).fetchone()
    if row2:
        print(f"users: tier={row2[0]}")
    else:
        print("users: NO ROW FOUND")
