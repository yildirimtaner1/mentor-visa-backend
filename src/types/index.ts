export type ComplianceStatus = 'compliant' | 'risk' | 'non_compliant';
export type Severity = 'low' | 'medium' | 'high';
export type MatchLevel = 'high' | 'medium' | 'low';
export type FinalVerdict = 'ready' | 'revise_minor' | 'revise_major';

export interface Risk {
  issue: string;
  severity: Severity;
  impact: string;
  recommendation: string;
}

export interface NocDutyMatch {
  official_noc_duty: string;
  applicant_duty: string;
  overlap_description: string;
}

export interface NOCAnalysis {
  applicable: boolean;
  detected_code: string;
  detected_title: string;
  match_level: MatchLevel;
  notes: string;
  lead_statement_official: string;
  lead_statement_applicant: string;
  lead_statement_overlap: string;
  duties_match: NocDutyMatch[];
}

export interface MandatoryRequirements {
  company_letterhead: boolean;
  applicant_name: boolean;
  contact_information: boolean;
  job_title: boolean;
  dates_of_employment: boolean;
  hours_worked: boolean;
  salary_compensation: boolean;
  signatory: boolean;
}

export interface AnalysisResponse {
  document_type: string;
  role_name?: string;
  company_name?: string;
  stored_file_id?: string;
  original_filename?: string;
  compliance_status: ComplianceStatus;
  summary: string;
  strengths: string[];
  risks: Risk[];
  missing_elements: string[];
  recommended_fixes: string[];
  suggested_wording: string[];
  noc_analysis: NOCAnalysis;
  mandatory_requirements: MandatoryRequirements;
  final_verdict: FinalVerdict;
}
