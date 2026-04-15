import json

flash = json.load(open('comparison_flash.json', 'r', encoding='utf-8'))
pro = json.load(open('comparison_pro.json', 'r', encoding='utf-8'))

def g(d, *keys):
    v = d
    for k in keys:
        if isinstance(v, dict): v = v.get(k, 'N/A')
        else: return 'N/A'
    return v

rows = [
    ('Decision', g(flash,'decision'), g(pro,'decision')),
    ('Confidence Score', g(flash,'confidence_score'), g(pro,'confidence_score')),
    ('', '', ''),
    ('NOC Code', g(flash,'noc_analysis','detected_code'), g(pro,'noc_analysis','detected_code')),
    ('NOC Title', str(g(flash,'noc_analysis','detected_title'))[:30], str(g(pro,'noc_analysis','detected_title'))[:30]),
    ('NOC Match Score', g(flash,'noc_analysis','match_score'), g(pro,'noc_analysis','match_score')),
    ('NOC Confidence', g(flash,'noc_analysis','confidence'), g(pro,'noc_analysis','confidence')),
    ('Duty Coverage %', g(flash,'noc_analysis','duty_coverage_percentage'), g(pro,'noc_analysis','duty_coverage_percentage')),
    ('', '', ''),
    ('Compliance Score', g(flash,'compliance','score'), g(pro,'compliance','score')),
    ('Overall Risk', g(flash,'risk_assessment','overall_risk'), g(pro,'risk_assessment','overall_risk')),
    ('PFL Likelihood', g(flash,'risk_assessment','pfl_likelihood'), g(pro,'risk_assessment','pfl_likelihood')),
    ('', '', ''),
    ('# Risks Found', len(g(flash,'risk_assessment','key_risks') or []), len(g(pro,'risk_assessment','key_risks') or [])),
    ('# Missing Duties', len(g(flash,'noc_analysis','missing_critical_duties') or []), len(g(pro,'noc_analysis','missing_critical_duties') or [])),
    ('# Refusal Reasons', len(g(flash,'refusal_reasons') or []), len(g(pro,'refusal_reasons') or [])),
    ('# Action Items', len(g(flash,'action_plan') or []), len(g(pro,'action_plan') or [])),
    ('# Suggested Wordings', len(g(flash,'suggested_wording') or []), len(g(pro,'suggested_wording') or [])),
    ('', '', ''),
    ('Location', g(flash,'noc_analysis','location_of_experience'), g(pro,'noc_analysis','location_of_experience')),
    ('Response Time', '24.3s', '54.7s'),
]

print()
print(f"  {'Metric':<25} {'Flash':<25} {'Pro':<25}")
print(f"  {'-'*25} {'-'*25} {'-'*25}")
for label, fv, pv in rows:
    if label == '':
        print()
        continue
    fs = str(fv)[:24]
    ps = str(pv)[:24]
    diff = ' <<DIFF>>' if fs != ps else ''
    print(f"  {label:<25} {fs:<25} {ps:<25}{diff}")

# Duty comparison
flash_duties = g(flash, 'noc_analysis', 'duties_match') or []
pro_duties = g(pro, 'noc_analysis', 'duties_match') or []
print(f"\n  {'-'*80}")
print(f"  DUTY MATCH STRENGTH COMPARISON")
print(f"  {'-'*80}")
mx = max(len(flash_duties), len(pro_duties))
for i in range(mx):
    fd = flash_duties[i] if i < len(flash_duties) else {}
    pd = pro_duties[i] if i < len(pro_duties) else {}
    noc = (fd.get('noc_duty', '--'))[:48]
    fs = fd.get('match_strength', '--')
    ps = pd.get('match_strength', '--')
    diff = ' <<DIFF>>' if fs != ps else ''
    print(f"  {i+1:2}. {noc:<48} {fs:<12} {ps:<12}{diff}")

# Narratives
print(f"\n  {'-'*80}")
print(f"  OFFICER NARRATIVE -- Flash:")
print(f"  {'-'*80}")
print(f"  {g(flash, 'officer_narrative')}")
print(f"\n  {'-'*80}")
print(f"  OFFICER NARRATIVE -- Pro:")
print(f"  {'-'*80}")
print(f"  {g(pro, 'officer_narrative')}")
