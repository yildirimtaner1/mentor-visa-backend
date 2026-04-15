import jwt, requests

token = jwt.encode({'sub': 'test_new_user'}, 'secret', algorithm='HS256')
res = requests.post('http://localhost:8000/api/v1/create-checkout-session', json={'pass_type': 'auditor', 'return_path': '/dashboard'}, headers={'Authorization': f'Bearer {token}'})
print("STATUS CODE:", res.status_code)
print("RESPONSE TEXT:", res.text)
