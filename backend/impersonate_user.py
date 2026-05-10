import requests
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Set your Clerk Secret Key here or via environment variable CLERK_SECRET_KEY
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "sk_live_YOUR_CLERK_SECRET_KEY_HERE")

def create_impersonation_link(user_id):
    if CLERK_SECRET_KEY.startswith("sk_live_YOUR"):
        print("ERROR: Please set your CLERK_SECRET_KEY in the script or as an environment variable.")
        print("You can find this in your Clerk Dashboard under 'API Keys' -> 'Secret Keys'.")
        sys.exit(1)

    url = "https://api.clerk.com/v1/sign_in_tokens"
    
    headers = {
        "Authorization": f"Bearer {CLERK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "user_id": user_id
    }
    
    print(f"Generating impersonation link for user: {user_id}...")
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("\nSuccess! Click the link below to sign in as this user:")
        print("-" * 50)
        print(data.get("url"))
        print("-" * 50)
        print("Note: This link expires in 30 days and can only be used once.")
    else:
        print(f"\nFailed to generate token. Status Code: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python impersonate_user.py <user_id>")
        print("Example: python impersonate_user.py user_2aXbYcZd...")
        sys.exit(1)
        
    target_user_id = sys.argv[1]
    create_impersonation_link(target_user_id)
