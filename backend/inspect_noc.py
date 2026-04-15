import json

with open("noc_index.json", encoding="utf-8") as f:
    data = json.load(f)

# noc_index.json is a list of objects
for entry in data:
    code = entry.get("code", "")
    title = entry.get("title", "")
    if "fire" in title.lower() or "safety" in title.lower() or code in ["22232", "42101", "42201"]:
        duties = entry.get("duties", [])
        print(f"\n=== NOC {code}: {title} ===")
        for d in duties[:8]:
            print(f"  - {d}")
