// ── Decision & Enum Types ──
export type Decision = 'ACCEPT' | 'PFL_RISK' | 'REFUSE';
export type MatchStrength = 'strong' | 'partial' | 'weak' | 'missing';
export type Severity = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type PFLLikelihood = 'low' | 'medium' | 'high';

// ── NOC Analysis ──

export interface EvidenceMapping {
  noc_duty: string;
  letter_evidence: string;
  match_strength: MatchStrength;
  overlap_description: string;
}

export interface AlternativeNOC {
  noc_code: string;
  noc_title: string;
  match_score: number;
  explanation: string;
}

export interface NOCAnalysis {
  applicable: boolean;
  detected_code: string;
  detected_title: string;
  match_score: number;
  confidence: number;
  noc_match_confidence?: number;  // backend-computed; same metric & value as the NOC Finder
  coverage_subtitle?: string;     // for multi-title NOCs: the sub-occupation coverage was scoped to
  alternative_nocs: AlternativeNOC[];
  notes: string;
  lead_statement_official: string;
  lead_statement_applicant: string;
  lead_statement_overlap: string;
  duties_match: EvidenceMapping[];
  missing_critical_duties: string[];
  duty_coverage_percentage: number;
  location_of_experience: 'canada' | 'outside_canada' | 'unknown';
}

// ── Compliance ──

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

export interface Compliance {
  score: number;
  missing_elements: string[];
  warnings: string[];
}

// ── Risk Assessment ──

export interface KeyRisk {
  issue: string;
  severity: Severity;
  impact: string;
  recommendation: string;
}

export interface RiskAssessment {
  overall_risk: RiskLevel;
  pfl_likelihood: PFLLikelihood;
  key_risks: KeyRisk[];
}

// ── Main Response ──

export interface AnalysisResponse {
  // Identity
  document_type: string;
  role_name?: string;
  company_name?: string;
  stored_file_id?: string;
  original_filename?: string;

  // Core Decision
  decision: Decision;
  confidence_score: number;

  // Officer Assessment
  officer_narrative: string;

  // NOC Analysis
  noc_analysis: NOCAnalysis;

  // Compliance
  compliance: Compliance;
  mandatory_requirements: MandatoryRequirements;

  // Risk
  risk_assessment: RiskAssessment;

  // Actionable Outputs
  refusal_reasons: string[];
  action_plan: string[];
  suggested_wording: string[];

  // Premium unlock state (added by backend/frontend)
  is_premium_unlocked?: boolean | number;
}
