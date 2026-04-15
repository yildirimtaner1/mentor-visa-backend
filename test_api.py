import requests

url = "http://localhost:8000/api/v1/analyze"
file_path = "12-583-x2021001-eng.pdf"

print("Sending request to FastAPI...")
with open(file_path, "rb") as f:
    files = {"document": (file_path, f, "application/pdf")}
    data = {"noc_code": "21232"}
    response = requests.post(url, files=files, data=data)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
