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

export interface NOCAnalysis {
  applicable: boolean;
  detected_code: string;
  detected_title: string;
  match_level: MatchLevel;
  notes: string;
}

export interface AnalysisResponse {
  document_type: string;
  compliance_status: ComplianceStatus;
  summary: string;
  strengths: string[];
  risks: Risk[];
  missing_elements: string[];
  recommended_fixes: string[];
  suggested_wording: string[];
  noc_analysis: NOCAnalysis;
  final_verdict: FinalVerdict;
}
