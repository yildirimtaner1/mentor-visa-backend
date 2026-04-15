import json

pro = json.load(open('comparison_pro.json', 'r', encoding='utf-8'))

print('DECISION:', pro['decision'])
print()
print('REFUSAL REASONS:')
for r in pro.get('refusal_reasons', []):
    print('  -', r)
print()
print('KEY RISKS:')
for r in pro.get('risk_assessment', {}).get('key_risks', []):
    print('  [' + r['severity'].upper() + ']', r['issue'])
    print('    Impact:', r['impact'])
    print('    Fix:', r['recommendation'])
    print()
print('ACTION PLAN:')
for i, a in enumerate(pro.get('action_plan', []), 1):
    print('  ' + str(i) + '.', a)
print()
print('MISSING CRITICAL DUTIES:')
for d in pro.get('noc_analysis', {}).get('missing_critical_duties', []):
    print('  -', d)
print()
print('OFFICER NARRATIVE:')
print(pro.get('officer_narrative', ''))
