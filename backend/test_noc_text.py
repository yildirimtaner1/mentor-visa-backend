"""Test: NOC Finder with text input — verify role_name, company_name, and raw input are saved."""
import requests
import json

resp = requests.post("http://localhost:8000/api/v1/noc-finder", data={
    "job_title": "Software Developer",
    "duties_description": "Developing web applications using React and Python. Writing unit tests. Performing code reviews. Deploying applications to cloud infrastructure. Participating in agile sprint planning."
})

print(f"Status: {resp.status_code}")
result = resp.json()

# Check the fields we care about
print(f"\n--- KEY FIELDS ---")
print(f"role_name:              {result.get('role_name', '❌ MISSING')}")
print(f"company_name:           {result.get('company_name', '❌ MISSING')}")
print(f"user_input_job_title:   {result.get('user_input_job_title', '❌ MISSING')}")
print(f"user_input_duties:      {result.get('user_input_duties', '❌ MISSING')[:80]}...")
print(f"stored_file_id:         {result.get('stored_file_id', '❌ MISSING')}")

if result.get('noc_analysis'):
    ana = result['noc_analysis']
    print(f"\n--- NOC RESULT ---")
    print(f"NOC Code:  {ana.get('detected_code')}")
    print(f"NOC Title: {ana.get('detected_title')}")
    print(f"Score:     {ana.get('match_score')}%")
else:
    print(f"\n❌ No noc_analysis in response")

# Now check the DB record
print(f"\n--- DB VERIFICATION ---")
from dotenv import load_dotenv
load_dotenv()
from database import SessionLocal
import db_models

db = SessionLocal()
record = db.query(db_models.NocEvaluationRecord).filter_by(
    stored_file_id=result.get('stored_file_id')
).first()

if record:
    print(f"DB role_name:     {record.role_name}")
    print(f"DB company_name:  {record.company_name}")
    payload = record.payload if isinstance(record.payload, dict) else json.loads(record.payload)
    print(f"DB payload has user_input_job_title:  {'user_input_job_title' in payload}")
    print(f"DB payload has user_input_duties:     {'user_input_duties' in payload}")
    print(f"\n✅ ALL CHECKS PASSED" if record.role_name != "Unknown Role" else "\n⚠️ role_name is still 'Unknown Role'")
else:
    print("❌ Record not found in DB!")

db.close()
