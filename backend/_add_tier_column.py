"""Fix subscription_tier column in both tables and set starter for user."""
from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlalchemy import text

USER_ID = "user_3BeDlZjYenTU1n3ummT7fVT9lr7"

with engine.connect() as conn:
    # 1. Add column to users table if missing
    conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free' NOT NULL"
    ))
    conn.commit()
    print("[OK] users.subscription_tier column ready")

    # 2. Add column to pr_journeys table if missing
    conn.execute(text(
        "ALTER TABLE pr_journeys ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free'"
    ))
    conn.commit()
    print("[OK] pr_journeys.subscription_tier column ready")

    # 3. Set user's tier to starter in BOTH tables
    r1 = conn.execute(
        text("UPDATE users SET subscription_tier = 'starter' WHERE user_id = :uid"),
        {"uid": USER_ID}
    )
    conn.commit()
    print(f"[OK] users table: {r1.rowcount} row(s) updated")

    r2 = conn.execute(
        text("UPDATE pr_journeys SET subscription_tier = 'starter' WHERE user_id = :uid"),
        {"uid": USER_ID}
    )
    conn.commit()
    print(f"[OK] pr_journeys table: {r2.rowcount} row(s) updated")

    # 4. Verify
    row = conn.execute(
        text("SELECT u.subscription_tier as user_tier, j.subscription_tier as journey_tier FROM users u LEFT JOIN pr_journeys j ON u.user_id = j.user_id WHERE u.user_id = :uid"),
        {"uid": USER_ID}
    ).fetchone()
    if row:
        print(f"[VERIFIED] user_tier={row[0]}, journey_tier={row[1]}")
    else:
        print("[WARN] User not found")
