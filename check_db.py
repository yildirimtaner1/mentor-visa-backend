import sqlite3
import json

conn = sqlite3.connect('mentor_visa.db')
c = conn.cursor()

c.execute("SELECT id, document_type, payload FROM noc_evaluation_records ORDER BY id DESC LIMIT 5")
rows = c.fetchall()

for row in rows:
    print(f"ID: {row[0]}")
    print(f"Type: {row[1]}")
    try:
        payload = json.loads(row[2])
        print(json.dumps(payload, indent=2))
    except Exception as e:
        print(f"Not JSON or error: {row[2]}")
    print("-" * 40)

conn.close()
