/**
 * Document Requirements — Config-driven data for the personalized document checklist.
 * 
 * Each document definition includes:
 * - Which programs require it
 * - Processing time estimates
 * - Validity period (for expiry tracking)
 * - Link to the official source
 * - Which of the 12 mistakes it relates to
 */

export interface DocumentRequirement {
  type: string;
  label: string;
  requiredFor: ('fswp' | 'cec' | 'fstp' | 'all')[];
  processingTime: string;
  validityDays: number | null; // null = no expiry
  externalUrl: string;
  mistakeId: number | null; // links to one of the 12 mistakes
  category: 'language' | 'education' | 'identity' | 'employment' | 'financial' | 'security' | 'medical' | 'photos' | 'other';
  priority: 'high' | 'medium' | 'low';
  notes: string;
}

export const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  // ── Identity ──
  {
    type: 'passport',
    label: 'Valid Passport',
    requiredFor: ['all'],
    processingTime: 'Varies by country (1-6 weeks typical)',
    validityDays: null,
    externalUrl: '',
    mistakeId: null,
    category: 'identity',
    priority: 'high',
    notes: 'Must be valid for at least 1 year from application date. Include all passports held in the last 10 years.',
  },
  {
    type: 'digital_photos',
    label: 'Digital Photos (35mm × 45mm)',
    requiredFor: ['all'],
    processingTime: 'Same day (photo studio or DIY)',
    validityDays: 180, // Must be recent
    externalUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/apply-renew-replace/photo.html',
    mistakeId: 11,
    category: 'photos',
    priority: 'medium',
    notes: 'White background, no glasses, no hat. Exact dimensions required. This is mistake #11.',
  },

  // ── Language ──
  {
    type: 'language_test',
    label: 'Language Test Results (IELTS General / CELPIP / TEF)',
    requiredFor: ['all'],
    processingTime: 'IELTS results: 13 days. CELPIP: 4-5 business days.',
    validityDays: 730, // 2 years
    externalUrl: 'https://www.ielts.org/book-a-test',
    mistakeId: 1,
    category: 'language',
    priority: 'high',
    notes: '⚠️ Must be IELTS General Training, NOT Academic. This is mistake #1 — the most common error. Results valid for 2 years from test date.',
  },

  // ── Education ──
  {
    type: 'eca',
    label: 'Educational Credential Assessment (ECA)',
    requiredFor: ['fswp', 'cec'],
    processingTime: 'WES: 4-8 weeks. Other agencies: 4-12 weeks.',
    validityDays: 1825, // 5 years
    externalUrl: 'https://www.wes.org/ca/',
    mistakeId: 2,
    category: 'education',
    priority: 'high',
    notes: '⚠️ Must order the IMMIGRATION type, not the Academic/Professional type. This is mistake #2. Only needed for education completed outside Canada.',
  },

  // ── Employment ──
  {
    type: 'employment_letter_primary',
    label: 'Employment Reference Letter — Primary Employer',
    requiredFor: ['all'],
    processingTime: '1-3 weeks (request from HR department)',
    validityDays: null,
    externalUrl: '',
    mistakeId: 4,
    category: 'employment',
    priority: 'high',
    notes: '⚠️ Must include: company letterhead, job title, dates of employment, hours per week, salary, and detailed duties. This is mistake #4. Use our Employment Letter Auditor to verify.',
  },
  {
    type: 'employment_letter_secondary',
    label: 'Employment Reference Letter — Additional Employer(s)',
    requiredFor: ['fswp'],
    processingTime: '1-3 weeks',
    validityDays: null,
    externalUrl: '',
    mistakeId: 4,
    category: 'employment',
    priority: 'medium',
    notes: 'Same requirements as primary letter. Needed if claiming experience from multiple employers.',
  },

  // ── Financial ──
  {
    type: 'proof_of_funds',
    label: 'Proof of Funds — Bank Letter',
    requiredFor: ['fswp'],
    processingTime: '1-2 weeks (request from bank)',
    validityDays: 90, // Should be recent
    externalUrl: '',
    mistakeId: 12,
    category: 'financial',
    priority: 'high',
    notes: '⚠️ Must include: letterhead, account holder name, account numbers, date opened, current balance, 6-month average balance, outstanding debts. This is mistake #12. Use our Bank Letter Auditor to verify.',
  },

  // ── Security ──
  // Police certificates are dynamically generated based on countries_lived_in

  // ── Medical ──
  {
    type: 'medical_exam',
    label: 'Immigration Medical Exam (IMM 1017B)',
    requiredFor: ['all'],
    processingTime: '1-4 weeks (book with IRCC panel physician)',
    validityDays: 365, // 12 months
    externalUrl: 'https://secure.cic.gc.ca/pp-md/pp-list.aspx',
    mistakeId: 8,
    category: 'medical',
    priority: 'high',
    notes: '⚠️ As of Aug 2025, medical exam must be completed upfront (before ITA submission). This is mistake #8.',
  },

  // ── Spouse ──
  {
    type: 'marriage_certificate',
    label: 'Marriage Certificate / Common-Law Declaration',
    requiredFor: ['all'],
    processingTime: 'Varies',
    validityDays: null,
    externalUrl: '',
    mistakeId: null,
    category: 'other',
    priority: 'medium',
    notes: 'Required if applying with a spouse/partner. Must be officially certified/translated if not in English or French.',
  },
  {
    type: 'spouse_passport',
    label: 'Spouse — Valid Passport',
    requiredFor: ['all'],
    processingTime: 'Varies',
    validityDays: null,
    externalUrl: '',
    mistakeId: null,
    category: 'identity',
    priority: 'medium',
    notes: 'Required if spouse/partner is accompanying.',
  },
  {
    type: 'spouse_language_test',
    label: 'Spouse — Language Test Results',
    requiredFor: ['all'],
    processingTime: 'Same as primary language test',
    validityDays: 730,
    externalUrl: '',
    mistakeId: null,
    category: 'language',
    priority: 'medium',
    notes: 'Spouse language scores can add up to 20 CRS points. Even if not required, it\'s worth it for competitive scores.',
  },
];


// ── The 12 Mistakes ──

export interface MistakeDefinition {
  id: number;
  title: string;
  consequence: string;
  howWePreventIt: string;
  severity: 'critical' | 'high' | 'medium';
  actionButton?: {
    label: string;
    route: string;
  };
  detailedExplanation: string;
}

export const THE_12_MISTAKES: MistakeDefinition[] = [
  {
    id: 1,
    title: 'Taking IELTS Academic instead of General Training',
    consequence: 'Results rejected by IRCC. $300+ wasted. Months lost.',
    howWePreventIt: 'Test type validator: we verify it\'s General Training',
    severity: 'critical',
    detailedExplanation: 'IRCC only accepts IELTS General Training for Express Entry. The Academic version (used for university admissions) is NOT valid. Many test centers default to Academic — always double-check when booking. If you\'ve already taken Academic, you must retake the General Training version.',
  },
  {
    id: 2,
    title: 'Getting the wrong type of ECA (academic instead of immigration)',
    consequence: 'ECA rejected. 2-3 months wasted waiting for a new one.',
    howWePreventIt: 'WES order type checker + warning',
    severity: 'critical',
    detailedExplanation: 'WES offers two types of assessments: one for immigration and one for academic purposes. You MUST select "ECA Application for IRCC" when ordering. The academic version will not be accepted by IRCC. This mistake alone can delay your application by months.',
  },
  {
    id: 3,
    title: 'Choosing NOC based on job title, not duties',
    consequence: 'Application refused for misrepresentation.',
    howWePreventIt: 'AI-powered NOC Finder matches based on actual duties',
    severity: 'critical',
    actionButton: { label: 'Find My NOC', route: '/find-my-noc' },
    detailedExplanation: 'Many applicants pick a NOC code that matches their job title but not their actual duties. IRCC evaluates your duties, not your title. For example, a "Product Manager" might be NOC 20012 (Computer and information systems managers) or NOC 11202 (Professional occupations in advertising, marketing and public relations). The wrong choice can lead to a misrepresentation finding and a 5-year ban.',
  },
  {
    id: 4,
    title: 'Employment letter missing required elements',
    consequence: 'Work experience disqualified. Points lost.',
    howWePreventIt: 'AI Employment Letter Auditor checks for all required fields',
    severity: 'critical',
    actionButton: { label: 'Audit My Letter', route: '/audit-employment-letter' },
    detailedExplanation: 'Your employment reference letter MUST include: (1) Company letterhead, (2) Your job title, (3) Start and end dates, (4) Hours per week, (5) Annual salary or hourly rate, (6) Detailed duties matching your NOC. Missing ANY of these can result in your work experience being disqualified.',
  },
  {
    id: 5,
    title: 'Expired language test results',
    consequence: 'Must retake the test, delaying application 2-3 months.',
    howWePreventIt: 'Expiry countdown tracker with alerts',
    severity: 'high',
    detailedExplanation: 'IELTS and CELPIP results are valid for only 2 years from the test date. If your results expire before you submit your application, you must retake the test. Plan your timeline carefully — if your ITA might come close to your test expiry, consider rebooking early.',
  },
  {
    id: 6,
    title: 'Missing police certificate for a country lived in 6+ months',
    consequence: 'Application returned incomplete. Months of delays.',
    howWePreventIt: 'Country history questionnaire auto-generates your list',
    severity: 'high',
    detailedExplanation: 'You need a police certificate from EVERY country where you lived for 6 months or more since age 18. This includes countries where you studied abroad, did internships, or had work assignments. Some countries take weeks or months to issue certificates (India: 3-4 weeks, USA: 12-16 weeks). Start early.',
  },
  {
    id: 7,
    title: 'Submitting FSWP without proof of funds',
    consequence: 'Application refused immediately.',
    howWePreventIt: 'Program-specific requirement flag + bank letter template',
    severity: 'critical',
    detailedExplanation: 'FSWP requires you to prove you have enough money to settle in Canada. The minimum is $14,690 CAD for a single applicant (2026). CEC applicants who are currently working in Canada are exempt. The proof must be a recent bank letter — not just a bank statement.',
  },
  {
    id: 8,
    title: 'Medical exam not completed upfront',
    consequence: 'Application cannot be submitted.',
    howWePreventIt: 'Prominent warning with panel physician finder link',
    severity: 'critical',
    detailedExplanation: 'As of August 2025, IRCC requires upfront medical exams for Express Entry applications. You must complete your medical with an IRCC-approved panel physician BEFORE submitting your application. Find a panel physician early — appointments can fill up fast in some cities.',
  },
  {
    id: 9,
    title: 'Inconsistent dates or names across documents',
    consequence: 'Flagged as misrepresentation. Potential 5-year ban.',
    howWePreventIt: 'Cross-document consistency checker',
    severity: 'critical',
    detailedExplanation: 'IRCC cross-references all your documents. If your employment letter says you started in January 2020 but your tax documents show income starting March 2020, this inconsistency can trigger a misrepresentation review. Similarly, name variations between documents (middle name included vs. not) can cause issues. Be meticulous.',
  },
  {
    id: 10,
    title: 'Omitting past visa refusals or travel history',
    consequence: 'Misrepresentation — 5-year ban from all Canadian immigration.',
    howWePreventIt: 'Explicit disclosure prompt with clear explanation',
    severity: 'critical',
    detailedExplanation: 'You MUST disclose all previous visa refusals to any country, even if they seem irrelevant. IRCC shares data with other immigration authorities (USA, UK, Australia, etc.) through the Five Country Conference. Omitting a refusal is treated as misrepresentation, which carries a 5-year ban. Honesty is always the safest path.',
  },
  {
    id: 11,
    title: 'Photos that don\'t meet specifications',
    consequence: 'Application returned for correction. Delays.',
    howWePreventIt: 'Photo specification guide with examples',
    severity: 'medium',
    detailedExplanation: 'Photos must be exactly 35mm × 45mm, with a white background, no glasses, no hat (unless religious), and a neutral expression. The head must be centered and occupy 31-36mm of the frame height. Many applicants use photos that are slightly wrong — this causes unnecessary returns.',
  },
  {
    id: 12,
    title: 'Proof of funds letter missing required details',
    consequence: 'Funds not accepted. Application stalled or refused.',
    howWePreventIt: 'AI Bank Letter Auditor checks for all 7 required elements',
    severity: 'critical',
    // actionButton: Bank Letter Auditor not yet built — add back when implemented
    detailedExplanation: 'Your bank letter must include 7 specific elements: (1) Bank letterhead with contact info, (2) Account holder name matching passport, (3) Account numbers, (4) Date accounts were opened, (5) Current balance, (6) Average balance over last 6 months, (7) Outstanding debts. The #1 missing element is the 6-month average balance — most banks don\'t include this unless you specifically ask.',
  },
];
