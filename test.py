import urllib.request, json, urllib.error
req = urllib.request.Request(
    'http://localhost:8000/api/v1/noc-finder',
    data=json.dumps({'job_title':'S','duties_description':'D'}).encode('utf-8'),
    headers={'Content-Type':'application/json'}
)
try:
    r = urllib.request.urlopen(req)
    print("Success:")
    print(r.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error:")
    print(e.read().decode('utf-8'))
