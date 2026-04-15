import json, os

os.makedirs('.dev_cache', exist_ok=True)

# Seed: analyze (auditor) cache
analyze = {
    "document_type": "Employment Letter - Canada",
    "compliance_status": "compliant",
    "summary": "This employment letter from ABC Tech Solutions confirms John Doe's role as a Software Developer. The letter is well-structured, printed on company letterhead, and contains most IRCC mandatory elements.",
    "role_name": "Software Developer",
    "company_name": "ABC Tech Solutions Inc.",
    "strengths": [
        "Letter is on official company letterhead with logo",
        "Clearly states full name and job title",
        "Provides specific start and end dates",
        "Lists detailed duties aligning with NOC 21232",
        "Signed by HR Manager with contact details"
    ],
    "risks": [
        {"issue": "No mention of hours worked per week", "impact": "IRCC requires confirmation of full-time (30+ hours/week)", "severity": "high", "recommendation": "Add: 'Mr. Doe worked 40 hours per week, full-time.'"},
        {"issue": "Salary/compensation not mentioned", "impact": "IRCC expects confirmation of paid employment", "severity": "medium", "recommendation": "Add annual salary or hourly wage."}
    ],
    "missing_elements": ["Number of hours worked per week", "Salary or compensation details"],
    "recommended_fixes": [
        "Add a line stating hours worked per week",
        "Include compensation details",
        "Add supervisor's direct phone number"
    ],
    "suggested_wording": [
        "Mr. Doe worked on a full-time basis, averaging 40 hours per week.",
        "Mr. Doe received an annual salary of $85,000 CAD, paid bi-weekly.",
        "For verification, contact Jane Smith, HR Manager, at (416) 555-0199."
    ],
    "noc_analysis": {
        "applicable": True,
        "detected_code": "21232",
        "detected_title": "Software developers and programmers",
        "match_score": 87,
        "lead_statement_official": "Software developers and programmers design, develop, test and maintain software applications, websites and databases.",
        "lead_statement_applicant": "Mr. Doe was responsible for designing, developing, and maintaining web applications and internal tools.",
        "lead_statement_overlap": "Both describe the core responsibility of designing, developing, and maintaining software applications.",
        "notes": "Duties strongly align with NOC 21232. Clear experience in development, testing, and deployment.",
        "alternative_nocs": [
            {"noc_code": "21234", "noc_title": "Web developers and programmers", "match_score": 72, "explanation": "Some duties overlap with web development."},
            {"noc_code": "21231", "noc_title": "Software engineers and designers", "match_score": 68, "explanation": "Some engineering tasks but lacks formal design methodology."}
        ],
        "duties_match": [
            {"official_noc_duty": "Write, modify, integrate and test software code for e-commerce, Internet and mobile applications", "applicant_duty": "Developed and maintained responsive web applications using React, Node.js, and Python", "overlap_description": "Direct alignment in writing and maintaining software code for web applications."},
            {"official_noc_duty": "Maintain existing computer programs by making modifications as required", "applicant_duty": "Performed regular maintenance and bug fixes on legacy systems", "overlap_description": "Clear match in maintaining existing programs and resolving defects."},
            {"official_noc_duty": "Identify and communicate technical problems, processes and solutions", "applicant_duty": "Collaborated with cross-functional teams to identify and resolve technical issues", "overlap_description": "Strong alignment in identifying and communicating technical problems."},
            {"official_noc_duty": "Prepare reports, manuals and other documentation on the status, operation and maintenance of software", "applicant_duty": "Created technical documentation for internal APIs and deployment procedures", "overlap_description": "Matching duty in preparing software documentation."}
        ],
        "location_of_experience": "canada"
    },
    "mandatory_requirements": {
        "company_letterhead": True,
        "applicant_name": True,
        "contact_information": True,
        "job_title": True,
        "dates_of_employment": True,
        "hours_worked": False,
        "salary_compensation": False,
        "signatory": True
    },
    "final_verdict": "revise_minor"
}

with open('.dev_cache/analyze.json', 'w') as f:
    json.dump(analyze, f, indent=2)
print("analyze.json seeded")

# Seed: noc_finder cache
noc_finder = {
    "document_valid": True,
    "rejection_reason": "",
    "noc_analysis": {
        "applicable": True,
        "detected_code": "21232",
        "detected_title": "Software developers and programmers",
        "match_score": 85,
        "lead_statement_official": "Software developers and programmers design, develop, test and maintain software applications.",
        "lead_statement_applicant": "Responsible for full-stack web development, building and maintaining enterprise applications.",
        "lead_statement_overlap": "Both describe designing, developing, and maintaining software applications.",
        "notes": "Strong match. The duties described clearly fall under software development and programming.",
        "alternative_nocs": [
            {"noc_code": "21234", "noc_title": "Web developers and programmers", "match_score": 70, "explanation": "Some web-specific duties overlap but role is broader."},
            {"noc_code": "21231", "noc_title": "Software engineers and designers", "match_score": 65, "explanation": "Engineering aspects present but not the primary focus."}
        ],
        "duties_match": [
            {"official_noc_duty": "Write, modify, integrate and test software code", "applicant_duty": "Developed and tested web applications using React and Node.js", "overlap_description": "Direct alignment in writing and testing software code."},
            {"official_noc_duty": "Maintain existing computer programs by making modifications", "applicant_duty": "Maintained and updated legacy codebases for stability", "overlap_description": "Clear match in maintaining existing programs."},
            {"official_noc_duty": "Identify and communicate technical problems and solutions", "applicant_duty": "Participated in code reviews and troubleshooting sessions", "overlap_description": "Aligns with identifying and communicating technical issues."}
        ],
        "location_of_experience": "canada"
    }
}

with open('.dev_cache/noc_finder.json', 'w') as f:
    json.dump(noc_finder, f, indent=2)
print("noc_finder.json seeded")
print("Done! Both caches seeded.")
