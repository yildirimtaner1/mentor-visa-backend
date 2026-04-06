import type { FC } from 'react';
import { SEO } from './common/SEO';

interface CECGuidePageProps {
  onNavigate: (page: string) => void;
}

export const CECGuidePage: FC<CECGuidePageProps> = ({ onNavigate }) => {
  return (
    <div>
      <SEO 
        title="Express Entry Canadian Experience Class (CEC) Document Checklist & Guide" 
        description="Learn exactly what documents IRCC requires for the Canadian Experience Class (CEC) Express Entry program. Avoid application rejection with our official guidelines."
        canonical="/express-entry-cec-guide"
      />
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📘 Complete CEC Guide</div>
          <h1>Your Complete Guide to<br /><span className="hero-highlight">Canadian Experience Class</span></h1>
          <p>Everything you need to know about CEC eligibility, requirements, and how to build a strong Express Entry application.</p>
        </div>
      </section>

      <div className="page-container">
        {/* What is CEC */}
        <section className="page-section">
          <h2 className="page-section-title">What is Canadian Experience Class?</h2>
          <p className="page-section-subtitle">
            The Canadian Experience Class (CEC) is one of the three federal immigration programs managed through Express Entry. 
            It is specifically designed for skilled workers who have already gained <strong>at least one year of Canadian work experience</strong> and want to transition to permanent residency.
          </p>
          <div className="highlight-box highlight-box-blue">
            <p>
              💡 <strong>Why CEC is popular:</strong> IRCC frequently holds <strong>CEC-specific draws</strong> with lower score cutoffs. You compete in an exclusive pool of candidates already in Canada, making it a highly reliable and fast path to PR.
            </p>
          </div>
        </section>

        {/* Eligibility */}
        <section className="page-section">
          <h2 className="page-section-title">Eligibility Requirements</h2>
          <p className="page-section-subtitle">You must meet all of the following criteria to be eligible for CEC.</p>
          
          <div className="info-grid">
            <div className="info-card">
              <div className="info-card-icon">💼</div>
              <h3>1 Year of Canadian Work Experience</h3>
              <p>You need at least 12 months of full-time (or equivalent part-time) skilled work experience in Canada within the last 3 years. The work must be paid — volunteer and unpaid internships do not count.</p>
            </div>
            <div className="info-card">
              <div className="info-card-icon">🏷️</div>
              <h3>TEER 0, 1, 2, or 3 Occupation</h3>
              <p>Your job must fall under TEER categories 0 (Management), 1 (Professional), 2 (Technical/Skilled Trades), or 3 (Intermediate) in the NOC 2021 system. TEER 4 and 5 occupations are not eligible.</p>
            </div>
            <div className="info-card">
              <div className="info-card-icon">🗣️</div>
              <h3>Language Proficiency</h3>
              <p><strong>TEER 0 or 1:</strong> CLB 7 in all abilities (speaking, listening, reading, writing).<br/>
              <strong>TEER 2 or 3:</strong> CLB 5 in all abilities.<br/>
              Accepted tests: IELTS General Training or CELPIP-General (English), TEF Canada or TCF Canada (French).</p>
            </div>
            <div className="info-card">
              <div className="info-card-icon">🏠</div>
              <h3>Plan to Live Outside Quebec</h3>
              <p>You must plan to live and work in any province or territory except Quebec. Quebec has its own immigration system (the Quebec Experience Program).</p>
            </div>
            <div className="info-card">
              <div className="info-card-icon">📄</div>
              <h3>Valid Work Authorization</h3>
              <p>Your Canadian work experience must have been gained while you held valid temporary resident status with authorization to work (e.g., Post-Graduation Work Permit (PGWP), Employer-specific work permit, or Open Work Permit). <br/><br/><strong>Important:</strong> Work experience gained while you were a full-time student (such as on a co-op work permit) does <strong>not</strong> count towards CEC eligibility.</p>
            </div>
            <div className="info-card">
              <div className="info-card-icon">⚕️</div>
              <h3>Admissibility</h3>
              <p>You must be admissible to Canada — meaning no serious criminal record, no medical inadmissibility, and no prior immigration violations.</p>
            </div>
          </div>
        </section>

        {/* Application Process */}
        <section className="page-section">
          <h2 className="page-section-title">Application Process</h2>
          <p className="page-section-subtitle">From creating your profile to landing as a permanent resident — here's the journey.</p>
          
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 1: Check Your Eligibility</h3>
              <p>Confirm you meet all CEC requirements: 1 year of Canadian skilled work experience (TEER 0-3), language test scores at or above the minimum CLB level, and admissibility.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 2: Get Your Language Test Results</h3>
              <p>Take either IELTS General Training / CELPIP-General (English) or TEF Canada / TCF Canada (French). Results must be less than 2 years old at the time of ITA.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 3: Gather Employment Letters</h3>
              <p>Request detailed reference letters from every employer that contributed to your 1 year of skilled work experience. Each letter must include your duties, title, dates, hours, and salary.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 4: Create Your Express Entry Profile</h3>
              <p>Submit your profile through the IRCC Express Entry system. You'll be given a Comprehensive Ranking System (CRS) score based on your age, education, language, and work experience.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 5: Receive an Invitation to Apply (ITA)</h3>
              <p>IRCC conducts regular draws from the Express Entry pool. If your CRS score meets the cutoff, you'll receive an ITA. Recently, CEC-specific draws have had cutoffs around 500-540.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 6: Submit Your Full Application</h3>
              <p>After receiving your ITA, you have 60 days to submit your complete application with all supporting documents: employment letters, language tests, police certificates, medical exam, and fees.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <h3>Step 7: Receive COPR & Become a Permanent Resident</h3>
              <p>Processing times are typically 3-6 months. Once approved, you'll receive your Confirmation of Permanent Residence (COPR) and can complete your landing.</p>
            </div>
          </div>
        </section>

        {/* Common Mistakes */}
        <section className="page-section">
          <h2 className="page-section-title">Common Mistakes That Lead to Refusals</h2>
          <p className="page-section-subtitle">Avoid these frequent pitfalls that cause CEC applications to be refused or returned.</p>
          
          <div className="mistake-card">
            <div className="mistake-card-icon">❌</div>
            <div>
              <h4>Employment Letter Missing Key Details</h4>
              <p>IRCC requires specific elements: job title, duties, dates, hours per week, salary, company letterhead, and a supervisor's signature. Missing even one can trigger a refusal.</p>
            </div>
          </div>
          <div className="mistake-card">
            <div className="mistake-card-icon">❌</div>
            <div>
              <h4>Duties Don't Match the Claimed NOC Code</h4>
              <p>If your employment letter lists duties that don't align with the lead statement and main duties of your claimed NOC code, the officer may determine your work experience doesn't qualify.</p>
            </div>
          </div>
          <div className="mistake-card">
            <div className="mistake-card-icon">❌</div>
            <div>
              <h4>Copy-Pasting NOC Duties Word-for-Word</h4>
              <p>Officers are trained to spot duties copied directly from the NOC website. Your letter should describe your actual duties in original language that naturally aligns with the NOC — not a verbatim copy.</p>
            </div>
          </div>
          <div className="mistake-card">
            <div className="mistake-card-icon">❌</div>
            <div>
              <h4>Insufficient Hours or Duration</h4>
              <p>CEC requires 1,560 hours of work (equivalent to 1 year full-time at 30+ hours/week). Part-time hours are acceptable but must accumulate to the same total over a longer period.</p>
            </div>
          </div>
          <div className="mistake-card">
            <div className="mistake-card-icon">❌</div>
            <div>
              <h4>Self-Employment or Volunteer Work</h4>
              <p>Self-employment hours do not count toward CEC work experience, regardless of NOC category. The work must be paid employment under an employer.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="page-section" style={{ textAlign: 'center', paddingBottom: '40px' }}>
          <h2 className="page-section-title">Ready to Check Your Employment Letter?</h2>
          <p className="page-section-subtitle">Let our AI audit your letter against all IRCC requirements and 516 NOC codes — for free.</p>
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate('audit')}>
            Audit Employment Letter — Free
          </button>
        </section>
      </div>
    </div>
  );
};
