import { type FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from './common/SEO';

interface GlossaryTerm {
  term: string;
  definition: string;
  relatedLink?: { label: string; to: string };
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'Additional Document Request (ADR)',
    definition: 'A request from IRCC asking an applicant to submit additional documents to support their permanent residence application. ADRs are issued when the officer reviewing the application needs more evidence. They are not a rejection, but failing to respond properly can lead to refusal.',
  },
  {
    term: 'Arranged Employment',
    definition: 'A valid job offer from a Canadian employer that is supported by a Labour Market Impact Assessment (LMIA), or is LMIA-exempt. Arranged employment can earn up to 200 additional CRS points in Express Entry.',
  },
  {
    term: 'Biometrics',
    definition: 'Fingerprints and a digital photograph collected by IRCC for identity verification purposes. Most applicants over the age of 14 and under 79 must provide biometrics when applying for permanent residence, a work permit, or a study permit.',
  },
  {
    term: 'Canadian Experience Class (CEC)',
    definition: 'One of three federal immigration programs managed through Express Entry. CEC is designed for candidates who have at least one year of skilled work experience in Canada (NOC TEER 0, 1, 2, or 3) within the last three years.',
    relatedLink: { label: 'Read CEC Guide', to: '/express-entry-cec-guide' },
  },
  {
    term: 'Canadian Language Benchmarks (CLB)',
    definition: 'The national standard used in Canada to describe, measure, and recognize the English or French language proficiency of adult immigrants. CLB levels range from 1 (basic) to 12 (advanced). Express Entry generally requires a minimum CLB 7 for the primary language.',
  },
  {
    term: 'CELPIP (Canadian English Language Proficiency Index Program)',
    definition: 'An English language proficiency test accepted by IRCC for Express Entry. CELPIP-General measures listening, reading, writing, and speaking skills on a scale of 1–12, which maps directly to CLB levels.',
  },
  {
    term: 'Certificate of Qualification',
    definition: 'A certification issued by a Canadian province, territory, or federal body that allows a person to work in a skilled trade. Having a valid certificate of qualification can earn additional CRS points under skill transferability factors.',
  },
  {
    term: 'Comprehensive Ranking System (CRS)',
    definition: 'The points-based system used to rank Express Entry candidates in the pool. The CRS score (out of 1,200) is calculated based on age, education, language skills, work experience, and additional factors like a provincial nomination or French-language proficiency.',
    relatedLink: { label: 'Calculate Your CRS', to: '/crs-calculator' },
  },
  {
    term: 'Confirmation of Permanent Residence (COPR)',
    definition: 'An official document issued by IRCC confirming that an applicant has been approved for permanent residence in Canada. The COPR must be presented at a port of entry or at an IRCC office to complete the immigration process.',
  },
  {
    term: 'Credentials Assessment',
    definition: 'See Educational Credential Assessment (ECA). The process of evaluating foreign educational credentials to determine their Canadian equivalency.',
  },
  {
    term: 'CRS Cut-Off Score',
    definition: 'The minimum CRS score needed to receive an Invitation to Apply (ITA) in a given Express Entry draw. Cut-off scores vary per round and are published by IRCC after each draw. Historically, general draws have ranged from approximately 415 to 560.',
  },
  {
    term: 'Dual Intent',
    definition: 'The principle that allows a foreign national to apply for temporary status in Canada (e.g., a work or study permit) while also intending to apply for permanent residence. Canadian immigration law explicitly recognizes dual intent.',
  },
  {
    term: 'Educational Credential Assessment (ECA)',
    definition: 'A report issued by a designated organization (e.g., WES, IQAS, CES) that verifies whether a foreign educational credential is equivalent to a completed Canadian credential. An ECA is required to claim education points in Express Entry for international education.',
  },
  {
    term: 'eAPR (Electronic Application for Permanent Residence)',
    definition: 'The online application submitted through the IRCC portal after receiving an Invitation to Apply (ITA). Applicants have 60 days from the ITA date to complete and submit this application.',
  },
  {
    term: 'Employment Letter (Reference Letter)',
    definition: 'A letter from an employer confirming the applicant\'s job title, duties, hours, salary, and employment period. IRCC requires specific formatting and content in employment letters for Express Entry applications. Missing elements can result in application refusal.',
    relatedLink: { label: 'Audit Your Letter', to: '/audit-employment-letter' },
  },
  {
    term: 'Express Entry',
    definition: 'Canada\'s primary application management system for three federal economic immigration programs: the Federal Skilled Worker Program (FSWP), the Federal Skilled Trades Program (FSTP), and the Canadian Experience Class (CEC). Candidates create an online profile, receive a CRS score, and are ranked in a pool.',
  },
  {
    term: 'Express Entry Profile',
    definition: 'The online profile a candidate creates and submits to enter the Express Entry pool. The profile includes information about age, education, language test results, work experience, and other factors. Profiles are valid for 12 months.',
  },
  {
    term: 'Federal Skilled Trades Program (FSTP)',
    definition: 'One of three federal programs under Express Entry, designed for people who want to become permanent residents based on being qualified in a skilled trade. Requires at least two years of full-time work experience in a skilled trade and a valid job offer or certificate of qualification.',
  },
  {
    term: 'Federal Skilled Worker Program (FSWP)',
    definition: 'The oldest and most common pathway under Express Entry. FSWP uses a separate 100-point eligibility grid (requiring 67/100 to qualify) based on language, education, work experience, age, arranged employment, and adaptability. It is designed for skilled workers with foreign work experience.',
  },
  {
    term: 'Global Case Management System (GCMS)',
    definition: 'The internal electronic system used by IRCC to process and track immigration applications. Applicants can request their GCMS notes through an Access to Information and Privacy (ATIP) request to see officer notes on their file.',
  },
  {
    term: 'IELTS (International English Language Testing System)',
    definition: 'An English language proficiency test accepted by IRCC. The IELTS General Training test is required for Express Entry (not the Academic version). Scores in listening, reading, writing, and speaking are converted to CLB levels.',
  },
  {
    term: 'Immigration, Refugees and Citizenship Canada (IRCC)',
    definition: 'The federal government department responsible for immigration and citizenship matters in Canada. IRCC processes Express Entry applications, issues visas, and administers citizenship programs.',
  },
  {
    term: 'Invitation to Apply (ITA)',
    definition: 'An official invitation from IRCC to submit a full permanent residence application. ITAs are issued to the highest-ranking candidates in the Express Entry pool during periodic draws. Once an ITA is received, the applicant has 60 days to submit their eAPR.',
  },
  {
    term: 'Job Bank',
    definition: 'Canada\'s national employment service operated by Employment and Social Development Canada (ESDC). Express Entry candidates can optionally register on Job Bank to be matched with participating employers.',
  },
  {
    term: 'Labour Market Impact Assessment (LMIA)',
    definition: 'A document that a Canadian employer may need to get before hiring a foreign worker. A positive LMIA confirms that there is a need for a foreign worker to fill a job and that no Canadian worker or permanent resident is available. An LMIA-backed job offer provides 50 or 200 additional CRS points.',
  },
  {
    term: 'Landing',
    definition: 'The process of completing permanent residence by presenting your COPR and passport at a Canadian port of entry or IRCC office. After "landing," the individual officially becomes a Canadian permanent resident.',
  },
  {
    term: 'Ministerial Instructions (MI)',
    definition: 'Directives issued by the Minister of Immigration that define the parameters for Express Entry draws. Since 2023, category-based selection rounds use MIs to target specific groups (e.g., French-speaking candidates, healthcare workers).',
  },
  {
    term: 'National Occupational Classification (NOC)',
    definition: 'The system used in Canada to classify and describe occupations. Each NOC code has a five-digit identifier, a title, and a list of official duties. Express Entry requires work experience in NOC TEER 0, 1, 2, or 3 occupations.',
    relatedLink: { label: 'Find Your NOC', to: '/find-my-noc' },
  },
  {
    term: 'NCLC (Niveaux de compétence linguistique canadiens)',
    definition: 'The French-language equivalent of the Canadian Language Benchmarks (CLB). NCLC levels are used to measure and express French language proficiency for immigration purposes.',
  },
  {
    term: 'NOC TEER Categories',
    definition: 'The Training, Education, Experience and Responsibilities (TEER) system classifies NOC occupations by skill level. TEER 0 requires management experience, TEER 1 a university degree, TEER 2 a college diploma or apprenticeship, TEER 3 on-the-job training. Express Entry accepts TEER 0, 1, 2, and 3.',
    relatedLink: { label: 'Browse NOC Directory', to: '/noc-codes' },
  },
  {
    term: 'Outland Application',
    definition: 'A permanent residence application processed outside of Canada. Applicants submit their eAPR while residing outside Canada and complete the landing process at a port of entry.',
  },
  {
    term: 'Permanent Residence (PR)',
    definition: 'The immigration status granted to a person who has been admitted to Canada as a permanent resident. PRs have the right to live and work anywhere in Canada, access healthcare, and apply for Canadian citizenship after meeting residency requirements.',
  },
  {
    term: 'Permanent Resident Card (PR Card)',
    definition: 'An identity document issued to Canadian permanent residents. It serves as proof of PR status and is required for re-entry to Canada when travelling by commercial carrier. PR Cards are typically valid for five years.',
  },
  {
    term: 'Police Clearance Certificate (PCC)',
    definition: 'A document issued by a law enforcement authority certifying that an individual has no criminal record. IRCC requires PCCs from every country where an applicant has lived for six months or more since age 18.',
  },
  {
    term: 'Pool',
    definition: 'The collection of all active Express Entry profiles. Candidates remain in the pool for up to 12 months, during which they may receive an ITA if their CRS score meets or exceeds the cut-off in a draw.',
  },
  {
    term: 'Port of Entry (POE)',
    definition: 'Any location (airport, land border, or sea port) where a person enters Canada and presents themselves to a border services officer. New permanent residents complete their "landing" at a POE.',
  },
  {
    term: 'Pre-Removal Risk Assessment (PRRA)',
    definition: 'An assessment conducted before removing a foreign national from Canada. It evaluates whether the person would face persecution, torture, or risk to life if returned to their home country.',
  },
  {
    term: 'Provincial Nominee Program (PNP)',
    definition: 'Programs operated by Canadian provinces and territories to nominate individuals who wish to immigrate to a specific province. A provincial nomination in Express Entry adds 600 CRS points, virtually guaranteeing an ITA.',
  },
  {
    term: 'PTE Core (Pearson Test of English)',
    definition: 'An English language proficiency test accepted by IRCC for Express Entry since late 2023. PTE Core scores are converted to CLB levels similar to IELTS and CELPIP.',
  },
  {
    term: 'Procedural Fairness Letter (PFL)',
    definition: 'A letter from IRCC informing an applicant of concerns about their application (e.g., misrepresentation, inadmissibility) and giving them an opportunity to respond before a final decision is made. Receiving a PFL does not automatically mean refusal.',
  },
  {
    term: 'R10 Requirements',
    definition: 'The regulatory requirements under Section 10 of the Immigration and Refugee Protection Regulations that define the completeness criteria for an application. For employment letters, R10 specifies the mandatory information (job title, duties performed, hours, salary, employment period, and more) that must be included.',
    relatedLink: { label: 'Audit Against R10', to: '/audit-employment-letter' },
  },
  {
    term: 'Reason for Decision Letter',
    definition: 'An official communication from IRCC explaining why an application was refused. It outlines the specific grounds for refusal and references the relevant sections of the Immigration and Refugee Protection Act (IRPA).',
  },
  {
    term: 'Rounds of Invitations (Draws)',
    definition: 'Periodic events where IRCC selects the highest-ranking candidates from the Express Entry pool and issues ITAs. Draws can be general (all programs) or category-based (targeting specific occupations, French speakers, etc.).',
  },
  {
    term: 'Settlement Funds',
    definition: 'The minimum amount of money an Express Entry applicant must demonstrate they have available to support themselves and their family upon arrival in Canada. The amount varies by family size and is updated annually. CEC applicants with valid job offers are exempt.',
  },
  {
    term: 'Significant Benefit (Work Permit)',
    definition: 'An LMIA-exempt work permit category where an employer demonstrates that hiring a foreign worker provides significant social, cultural, or economic benefit to Canada.',
  },
  {
    term: 'Skill Transferability Factors',
    definition: 'The third component of the CRS score (maximum 100 points) that awards points for combinations of education, language proficiency, Canadian work experience, foreign work experience, and trade certification working together.',
    relatedLink: { label: 'Calculate Your CRS', to: '/crs-calculator' },
  },
  {
    term: 'Spousal Sponsorship',
    definition: 'A family-class immigration pathway where a Canadian citizen or permanent resident sponsors their spouse or common-law partner for permanent residence. This is separate from Express Entry.',
  },
  {
    term: 'Study Permit',
    definition: 'A document issued by IRCC that authorizes a foreign national to study at a designated learning institution (DLI) in Canada. A study permit is not a visa — a separate entry visa (or eTA) may also be required.',
  },
  {
    term: 'TCF Canada (Test de connaissance du français)',
    definition: 'A French-language proficiency test accepted by IRCC for Express Entry. Results are valid for two years. TCF Canada assesses listening, reading, writing, and speaking, and scores are converted to NCLC levels.',
  },
  {
    term: 'TEF Canada (Test d\'évaluation de français)',
    definition: 'A French-language proficiency test accepted by IRCC for Express Entry. TEF Canada assesses listening, reading, writing, and speaking, and scores are converted to NCLC levels. Results are valid for two years.',
  },
  {
    term: 'TEER (Training, Education, Experience and Responsibilities)',
    definition: 'The classification system within the 2021 National Occupational Classification (NOC) that categorizes occupations by the level of training, education, experience, and responsibilities typically required. Express Entry accepts TEER 0, 1, 2, and 3.',
    relatedLink: { label: 'Find Your NOC', to: '/find-my-noc' },
  },
  {
    term: 'Temporary Resident Visa (TRV)',
    definition: 'Also known as a visitor visa. A document placed in a passport that allows a foreign national to travel to a Canadian port of entry. Citizens of visa-required countries need a TRV to enter Canada.',
  },
  {
    term: 'Tie-Breaking Rule',
    definition: 'When multiple Express Entry candidates share the same CRS score at the cut-off point of a draw, IRCC uses the timestamp of profile submission as a tie-breaker. The candidate who submitted their profile earlier receives the ITA.',
  },
  {
    term: 'Valid Job Offer',
    definition: 'A job offer that meets specific IRCC requirements: full-time, in a TEER 0/1/2/3 occupation, supported by an LMIA (or LMIA-exempt), for at least one year after the applicant becomes a permanent resident, and the employer is not on the ineligible list.',
  },
  {
    term: 'Voluntary Disclosure',
    definition: 'The act of proactively informing IRCC about errors, omissions, or changes in an application. Voluntary disclosure can help avoid misrepresentation findings, which carry a five-year ban from immigration applications.',
  },
  {
    term: 'WES (World Education Services)',
    definition: 'One of the designated organizations approved by IRCC to conduct Educational Credential Assessments (ECAs). WES is the most commonly used ECA provider for Express Entry applicants.',
  },
  {
    term: 'Work Permit',
    definition: 'A document issued by IRCC that authorizes a foreign national to work in Canada. Work permits can be employer-specific (tied to one employer) or open (allowing work for any employer). Types include LMIA-based, LMIA-exempt, post-graduation (PGWP), and spousal open work permits.',
  },
  {
    term: 'Category-Based Selection',
    definition: 'A type of Express Entry draw introduced in 2023 where IRCC targets candidates in specific categories such as healthcare occupations, STEM professions, trade occupations, transport occupations, agriculture and agri-food occupations, or French-language proficiency. These draws may have lower CRS cut-offs than general draws.',
  },
  {
    term: 'eTA (Electronic Travel Authorization)',
    definition: 'An entry requirement for visa-exempt foreign nationals travelling to Canada by air. An eTA is electronically linked to the traveller\'s passport and is valid for up to five years or until the passport expires.',
  },
  {
    term: 'French Language Bonus Points',
    definition: 'Additional CRS points awarded to Express Entry candidates with strong French-language skills. Candidates with NCLC 7+ in all four French abilities receive 25 bonus points (or 50 if they also have CLB 5+ in English).',
    relatedLink: { label: 'Calculate Your CRS', to: '/crs-calculator' },
  },
  {
    term: 'Inadmissibility',
    definition: 'A determination that a foreign national is not permitted to enter or remain in Canada. Grounds for inadmissibility include criminality, security concerns, health issues, misrepresentation, or financial reasons.',
  },
  {
    term: 'Inland Application',
    definition: 'A permanent residence application filed while the applicant is physically present in Canada. The applicant may be eligible for an open work permit (Bridging Open Work Permit - BOWP) while the application is being processed.',
  },
  {
    term: 'Invitation Round',
    definition: 'See Rounds of Invitations. An event where IRCC issues ITAs to Express Entry candidates who meet or exceed the draw\'s CRS cut-off score.',
  },
  {
    term: 'Medical Examination',
    definition: 'A mandatory health screening conducted by an IRCC-designated panel physician. All Express Entry applicants and their family members must pass a medical examination. Results are valid for 12 months.',
  },
  {
    term: 'Misrepresentation',
    definition: 'Providing false or misleading information, or withholding material facts, in an immigration application. A finding of misrepresentation results in a five-year ban from submitting new immigration applications and can lead to loss of PR status.',
  },
  {
    term: 'Post-Graduation Work Permit (PGWP)',
    definition: 'An open work permit available to international students who have graduated from an eligible designated learning institution (DLI) in Canada. The PGWP duration depends on the length of the study program (up to three years). Canadian work experience gained on a PGWP counts toward CEC eligibility.',
  },
  {
    term: 'Bridging Open Work Permit (BOWP)',
    definition: 'A work permit that bridges the gap between the expiry of a current work permit and the final decision on a permanent residence application. It is available to applicants who have submitted an inland PR application and whose current work permit is about to expire.',
  },
  {
    term: 'Designated Learning Institution (DLI)',
    definition: 'A school approved by a provincial or territorial government to host international students. Only study at DLIs qualifies international students for a study permit and potentially a Post-Graduation Work Permit.',
  },
  {
    term: 'Express Entry Draw Results',
    definition: 'The publicly announced outcomes of each Express Entry round, including the number of ITAs issued and the minimum CRS cut-off score. Draw results are published on the IRCC website after each round.',
  },
  {
    term: 'Proof of Funds (POF)',
    definition: 'Documentation (typically bank statements or investment certificates) showing that an Express Entry applicant has sufficient money to support themselves and their family upon arrival in Canada. The required amount is updated annually based on family size.',
  },
  {
    term: 'Biometrics Instruction Letter (BIL)',
    definition: 'A letter sent by IRCC after an application is submitted, instructing the applicant to provide biometrics (fingerprints and photo) at a designated collection point. The BIL includes a deadline (usually 30 days) and a unique identifier. Failure to comply within the deadline can result in application refusal.',
  },
  {
    term: 'Medical Check (Upfront Medical Examination)',
    definition: 'A mandatory health screening that must be completed by an IRCC-designated panel physician before or shortly after submitting a permanent residence application. The medical examination includes a physical exam, chest X-ray, blood tests, and urinalysis. Results are uploaded directly to IRCC\'s eMedical system and are valid for 12 months.',
  },
  {
    term: 'Background Check (Security Screening)',
    definition: 'A security and criminal background verification conducted by Canadian agencies (CSIS, RCMP, and sometimes international partners) on every permanent residence applicant. Background checks can take anywhere from a few weeks to several months, and are one of the most common causes of processing delays. The applicant has no control over the timeline.',
  },
  {
    term: 'Eligibility',
    definition: 'The minimum criteria an applicant must meet to qualify for a specific immigration program under Express Entry. For example, CEC requires at least one year of Canadian skilled work experience (TEER 0/1/2/3), while FSWP requires a score of at least 67 out of 100 on its eligibility grid. Being eligible does not guarantee an ITA — the applicant must also have a competitive CRS score.',
    relatedLink: { label: 'Check CEC Eligibility', to: '/express-entry-cec-guide' },
  },
  {
    term: 'eCOPR (Electronic Confirmation of Permanent Residence)',
    definition: 'A digital version of the Confirmation of Permanent Residence document. Originally introduced during COVID-19, eCOPR allows applicants inside Canada to confirm their permanent residence status without visiting a physical IRCC office or port of entry. The eCOPR is emailed to the applicant and has the same legal validity as a paper COPR.',
  },
  {
    term: 'RPRF (Right of Permanent Residence Fee)',
    definition: 'A mandatory government fee of $515 CAD per person (as of 2024) that must be paid before permanent residence is granted. The RPRF applies to the principal applicant and their spouse/common-law partner, but not to dependent children. It can be paid at any time after the ITA, but must be received by IRCC before the COPR is issued.',
  },
  {
    term: 'Portal 1 Email (P1)',
    definition: 'The first email an applicant receives from IRCC after submitting their eAPR (Electronic Application for Permanent Residence). The Portal 1 email provides access to the IRCC Permanent Residence Portal, where the applicant can upload documents, view application status updates, and respond to requests. Receiving P1 confirms that the application has been received and is being processed.',
  },
  {
    term: 'Portal 2 Email (P2)',
    definition: 'The second portal-related email from IRCC, typically sent in the later stages of application processing. The Portal 2 email provides access to an updated portal where the applicant can submit final documents, pay the RPRF (if not already paid), and provide updated information such as address or passport details. Receiving P2 generally indicates that the application is nearing a final decision.',
  },
  {
    term: 'Passport Request (PPR)',
    definition: 'A request from IRCC asking the applicant to submit their passport for visa stamping. Receiving a PPR is one of the final steps before landing and means the application has been approved in principle. For outland applicants, the passport is mailed to or dropped off at the designated visa office. For inland applicants in Canada, the equivalent step is typically an eCOPR or a request to attend an IRCC office.',
  },
  {
    term: 'Primary Visa Office (PVO)',
    definition: 'The main IRCC visa office assigned to process a permanent residence application. The PVO is typically determined by the applicant\'s country of residence or nationality. The PVO handles the majority of the application review, including document verification and eligibility assessment.',
  },
  {
    term: 'Secondary Visa Office (SVO)',
    definition: 'An additional IRCC visa office involved in processing certain aspects of a permanent residence application, typically security screening or background checks. The SVO is usually located in a country where the applicant has previously lived. Processing at the SVO can add significant time to the overall application timeline.',
  },
  {
    term: 'Dependant',
    definition: 'A family member included in a principal applicant\'s permanent residence application. Dependants typically include a spouse or common-law partner and dependent children under the age of 22 who do not have a spouse or common-law partner of their own. Dependants must also pass medical and security checks. Including dependants affects settlement fund requirements.',
  },
];

const glossarySchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "name": "Express Entry & Canadian Immigration Glossary",
  "description": "A comprehensive glossary of 70+ terms related to Canadian Express Entry, Permanent Residence, CRS scores, NOC codes, and immigration programs.",
  "url": "https://mentorvisa.com/glossary",
  "inDefinedTermSet": GLOSSARY_TERMS.slice(0, 10).map(t => ({
    "@type": "DefinedTerm",
    "name": t.term,
    "description": t.definition.substring(0, 200),
  })),
});

export const GlossaryPage: FC = () => {
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const sortedTerms = useMemo(() =>
    [...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term)),
    []
  );

  const letters = useMemo(() => {
    const set = new Set(sortedTerms.map(t => t.term[0].toUpperCase()));
    return Array.from(set).sort();
  }, [sortedTerms]);

  const filteredTerms = useMemo(() => {
    let terms = sortedTerms;
    if (activeLetter) {
      terms = terms.filter(t => t.term[0].toUpperCase() === activeLetter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
      );
    }
    return terms;
  }, [sortedTerms, activeLetter, search]);

  const toggleTerm = (term: string) => {
    setExpandedTerm(expandedTerm === term ? null : term);
  };

  return (
    <div>
      <SEO
        title="Express Entry & PR Glossary | 70+ Immigration Terms Explained"
        description="Understand every term in the Canadian Express Entry process. From CRS scores and NOC codes to ITAs and PNPs — our free glossary explains it all in plain language."
        canonical="/glossary"
        schema={glossarySchema}
      />

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📖 Free Immigration Resource</div>
          <h1>Express Entry &amp; PR<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>Glossary</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Over 70 immigration terms explained in plain language. From CRS scores and NOC codes to ITAs and Provincial Nominations — everything you need to navigate the Canadian immigration process with confidence.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📚 <span style={{ color: 'var(--primary-light)' }}>70+ Terms</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🔍 Searchable</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✅ Always Free</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>

            {/* Search Bar */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--surface-color)', border: '1.5px solid var(--border-color)',
                borderRadius: '12px', padding: '12px 16px',
                transition: 'border-color 0.2s ease',
              }}>
                <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search terms (e.g., CRS, LMIA, NOC...)"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setActiveLetter(null); }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: '1rem', color: 'var(--text-color)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 4px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Alphabet Filter */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '28px',
              justifyContent: 'center',
            }}>
              <button
                onClick={() => setActiveLetter(null)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.85rem',
                  background: !activeLetter ? 'var(--primary-color)' : '#F1F5F9',
                  color: !activeLetter ? 'white' : '#64748B',
                  transition: 'all 0.2s ease',
                }}
              >
                All
              </button>
              {letters.map(letter => (
                <button
                  key={letter}
                  onClick={() => { setActiveLetter(activeLetter === letter ? null : letter); setSearch(''); }}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.85rem', minWidth: '36px',
                    background: activeLetter === letter ? 'var(--primary-color)' : '#F1F5F9',
                    color: activeLetter === letter ? 'white' : '#64748B',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Results Count */}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 500 }}>
              Showing {filteredTerms.length} of {sortedTerms.length} terms
              {activeLetter && <> starting with "{activeLetter}"</>}
              {search && <> matching "{search}"</>}
            </div>

            {/* Glossary Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTerms.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '48px 24px',
                  color: 'var(--text-muted)', fontSize: '1rem',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
                  No terms found. Try a different search or filter.
                </div>
              )}

              {filteredTerms.map((item) => {
                const isExpanded = expandedTerm === item.term;
                return (
                  <div
                    key={item.term}
                    style={{
                      background: 'var(--surface-color)',
                      border: `1.5px solid ${isExpanded ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: isExpanded ? '0 4px 16px rgba(37, 99, 235, 0.08)' : 'none',
                    }}
                  >
                    <button
                      onClick={() => toggleTerm(item.term)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', gap: '12px',
                      }}
                    >
                      <span style={{
                        fontWeight: 700, fontSize: '0.95rem',
                        color: isExpanded ? 'var(--primary-color)' : 'var(--text-color)',
                        transition: 'color 0.2s ease',
                      }}>
                        {item.term}
                      </span>
                      <span style={{
                        fontSize: '1.2rem', color: 'var(--text-muted)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.25s ease',
                        flexShrink: 0,
                      }}>
                        ▾
                      </span>
                    </button>

                    {isExpanded && (
                      <div style={{
                        padding: '0 20px 18px',
                        animation: 'fadeIn 0.2s ease',
                      }}>
                        <p style={{
                          fontSize: '0.92rem', lineHeight: 1.7,
                          color: '#475569', margin: 0,
                        }}>
                          {item.definition}
                        </p>
                        {item.relatedLink && (
                          <Link
                            to={item.relatedLink.to}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              marginTop: '14px', fontSize: '0.88rem', fontWeight: 600,
                              color: 'var(--primary-color)', textDecoration: 'none',
                              padding: '6px 14px', borderRadius: '8px',
                              background: 'rgba(37, 99, 235, 0.06)',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            → {item.relatedLink.label}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div style={{
              marginTop: '48px', padding: '36px 28px', textAlign: 'center',
              background: 'linear-gradient(135deg, #0F172A, #1E3A8A)',
              borderRadius: '16px', color: 'white',
            }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'white' }}>
                Ready to Start Your Express Entry Journey?
              </h3>
              <p style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '24px', lineHeight: 1.6 }}>
                Use our free tools to find your NOC code, calculate your CRS score, and build IRCC-compliant employment letters.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  to="/find-my-noc"
                  className="btn btn-lg"
                  style={{ background: 'white', color: '#1E3A8A', fontWeight: 600, border: 'none', textDecoration: 'none' }}
                >
                  🎯 Find My NOC
                </Link>
                <Link
                  to="/crs-calculator"
                  className="btn btn-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 600, border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}
                >
                  📊 Calculate CRS
                </Link>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};
