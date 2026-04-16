import type { FC } from 'react';
import { Navbar } from './common/Navbar';
import { SEO } from './common/SEO';
import { Testimonials } from './ui/testimonials-columns-1';
import { Target, Search, XCircle, AlertTriangle, CheckCircle2, FileText, BrainCircuit, ListChecks, PieChart, FileDigit, RefreshCw, Zap, Pickaxe, LineChart } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onNavigate: (page: string) => void;
}

const faqSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What happens if I choose the wrong NOC code?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If the duties in your employment letter don't match the NOC code you claim, IRCC can refuse your Express Entry application. You may lose your filing fee and have to re-apply, which can take months."
      }
    },
    {
      "@type": "Question",
      "name": "Why can't I just use my job title to find my NOC?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Job titles vary between companies — 'Project Coordinator' at one company might be NOC 13100, while at another it could be NOC 11102. IRCC matches based on your actual duties, not your title. That's why duty-matching is critical."
      }
    },
    {
      "@type": "Question",
      "name": "How does this tool match my NOC code?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our AI reads the duties from your employment letter or pasted text and compares them against the official duties of all 516 NOC 2021 unit groups. It returns the best match with a confidence score and shows you exactly which duties align."
      }
    },
    {
      "@type": "Question",
      "name": "Is this tool a replacement for an immigration consultant?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. This tool helps you identify your NOC code quickly and accurately. For complex cases, we recommend consulting a licensed RCIC. But for straightforward NOC matching, this AI tool gives you the same answer in seconds instead of days."
      }
    },
    {
      "@type": "Question",
      "name": "What TEER categories are eligible for Express Entry CEC?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Express Entry's Canadian Experience Class (CEC) requires work experience in TEER 0, 1, 2, or 3 occupations. TEER 4 and 5 are generally not eligible. Our tool automatically tells you your TEER category and CEC eligibility."
      }
    }
  ]
});

export const LandingPage: FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="landing">
      <SEO 
        title="Find My NOC Code | AI-Powered NOC Matcher for Express Entry Canada" 
        description="Don't risk your PR application. Match your job duties to the correct NOC 2021 code in seconds. AI-powered duty matching across all 516 unit groups."
        keywords="NOC code finder, Express Entry NOC, find my NOC code 2021, NOC code for PR Canada, Canadian Experience Class NOC, TEER category finder"
        canonical="/"
        schema={faqSchema}
      />
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="hero relative overflow-hidden">
        <div className="hero-content relative z-10">
          <div className="hero-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Target size={14} /> AI-Powered NOC 2021 Matching</div>
          <h1 className="hero-title">
            Wrong NOC Code?<br />
            <span className="hero-highlight">Your PR Gets Refused.</span>
          </h1>
          <p className="hero-subtitle">
            Your job title doesn't determine your NOC code — your duties do. 
            Our AI reads your actual job duties and matches them against all 516 official NOC 2021 codes, so you don't have to guess.
          </p>
          <div className="hero-actions" style={{ marginBottom: '24px' }}>
            <button className="btn btn-primary btn-lg" onClick={() => onNavigate('find-my-noc')} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
              <Search size={18} /> Find My NOC Code Now
            </button>
          </div>

          <div className="hero-trust-badges">
            <div className="trust-badge">
              <div className="trust-icon-check">✓</div>
              <span className="trust-text"><strong>516 NOC codes.</strong> Every single one checked against your duties — in seconds, not hours.</span>
            </div>
            <div className="trust-badge">
              <div className="trust-icon-check">✓</div>
              <span className="trust-text"><strong>Strict IRCC Compliance.</strong> 100% based on the official NOC 2021 Version 1.0 Matrix. No AI hallucinations.</span>
            </div>
            <div className="trust-badge">
              <div className="trust-icon-check">✓</div>
              <span className="trust-text"><strong>Proven Accuracy.</strong> Model developed using thousands of real, successful PR employment letters.</span>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-number">516</div>
              <div className="hero-stat-label">NOC Codes Analyzed</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-number">4,974</div>
              <div className="hero-stat-label">Official Duties Compared</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-number">~30s</div>
              <div className="hero-stat-label">Average Result Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section className="section">
        <h2 className="section-title">Why Getting Your NOC Right Matters</h2>
        <p className="section-subtitle">IRCC doesn't care about your job title. They care about what you actually did.</p>
        <div className="features-grid">
          <div className="feature-card" style={{ borderLeft: '4px solid #EF4444' }}>
            <div className="feature-icon"><XCircle size={32} color="#EF4444" /></div>
            <h3>Wrong NOC = Application Refused</h3>
            <p>If the duties on your employment letter don't match the NOC code you claim, IRCC will refuse your application. No second chances — you lose your filing fee and months of waiting.</p>
          </div>
          <div className="feature-card" style={{ borderLeft: '4px solid #F59E0B' }}>
            <div className="feature-icon"><AlertTriangle size={32} color="#F59E0B" /></div>
            <h3>Job Titles Are Misleading</h3>
            <p>"Project Manager" at your company could be NOC 10019, 20012, or 13100 depending on what you actually do. IRCC officers match your duties, not your title. Guessing is risky.</p>
          </div>
          <div className="feature-card" style={{ borderLeft: '4px solid #10B981' }}>
            <div className="feature-icon"><CheckCircle2 size={32} color="#10B981" /></div>
            <h3>Duty-Based Matching Is the Only Way</h3>
            <p>Our AI does exactly what an IRCC officer does: reads your actual duties and compares them line-by-line against the official NOC 2021 database. No guessing, no gut feeling.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section section-dark">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Three steps. Under 60 seconds. No immigration knowledge needed.</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon"><FileText size={32} color="var(--primary-color)" /></div>
            <h3>Upload or Paste Your Duties</h3>
            <p>Upload your employment letter (PDF, Word, or photo). Or just paste your job title and duties directly — whatever is faster.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon"><BrainCircuit size={32} color="var(--primary-color)" /></div>
            <h3>AI Matches Your Duties to NOC</h3>
            <p>Our AI compares your duties against the official duties of all 516 NOC 2021 unit groups and finds the strongest match — with a confidence score.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon"><ListChecks size={32} color="var(--primary-color)" /></div>
            <h3>Get Your NOC Code + TEER</h3>
            <p>See your matched NOC code, TEER category, CEC eligibility, and alternative matches. Know exactly which code to claim on your application.</p>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="section">
        <h2 className="section-title">What You Get</h2>
        <p className="section-subtitle">Everything you need to confidently choose your NOC code.</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Target size={28} color="var(--primary-color)" /></div>
            <h3>Best-Match NOC Code</h3>
            <p>Your primary NOC match with a percentage score showing exactly how well your duties align with the official NOC description.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><PieChart size={28} color="var(--primary-color)" /></div>
            <h3>TEER Category + CEC Check</h3>
            <p>Instantly know your TEER level and whether your occupation qualifies for the Canadian Experience Class — no manual lookup needed.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><RefreshCw size={28} color="var(--primary-color)" /></div>
            <h3>Alternative Matches</h3>
            <p>See other NOC codes that also match your duties. Click any alternative to re-evaluate your duties strictly against that target code.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FileDigit size={28} color="var(--primary-color)" /></div>
            <h3>Duty-by-Duty Breakdown</h3>
            <p>See exactly which of your duties match which official NOC duties — the same comparison an IRCC officer would do.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FileText size={28} color="var(--primary-color)" /></div>
            <h3>Works With Any Format</h3>
            <p>Upload a PDF, Word doc, or photo of your letter. Or skip the upload entirely and just type your duties. We handle it all.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Zap size={28} color="var(--primary-color)" /></div>
            <h3>Results in Seconds</h3>
            <p>No waiting days for a consultant. Get your NOC match immediately. Re-evaluate against different codes as many times as you need.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section section-dark">
        <h2 className="section-title">Simple, One-Time Pricing</h2>
        <p className="section-subtitle">No subscriptions. No hidden fees. Pay only for what you need.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '960px', margin: '0 auto' }}>

          {/* Letter Builder */}
          <div className="feature-card" style={{ textAlign: 'center', padding: '32px 24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Pickaxe size={48} color="var(--primary-color)" /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>Employment Letter Builder</h3>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-color)', margin: '12px 0 4px' }}>
              $14.90 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>CAD</span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.88rem' }}>
              One-time purchase. One full letter build.
            </p>
            <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 24px 0', display: 'grid', gap: '10px', textAlign: 'left', fontSize: '0.88rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Step-by-step guided builder</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> AI duty alignment coaching</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> IRCC R10-compliant output</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> NOC-targeted duty matching</li>
            </ul>
            <div style={{ marginTop: 'auto' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('build-employment-letter')} style={{ width: '100%' }}>
                Build My Letter
              </button>
            </div>
          </div>

          {/* ITA Strategy — Featured */}
          <div className="feature-card" style={{ textAlign: 'center', border: '2px solid var(--primary-color)', boxShadow: '0 20px 40px rgba(37, 99, 235, 0.12)', padding: '32px 24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary-color)', color: 'white', padding: '4px 16px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>MOST POPULAR</div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><LineChart size={48} color="var(--primary-color)" /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>AI PR Strategy Report</h3>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-color)', margin: '12px 0 4px' }}>
              $19.90 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>CAD</span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.88rem' }}>
              One-time purchase. One personalized strategy.
            </p>
            <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 24px 0', display: 'grid', gap: '10px', textAlign: 'left', fontSize: '0.88rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Exact CRS score calculation</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Historical draw comparison</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Point maximization strategies</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Personalized PR roadmap</li>
            </ul>
            <div style={{ marginTop: 'auto' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('crs-calculator')} style={{ width: '100%' }}>
                Get My Strategy
              </button>
            </div>
          </div>

          {/* Letter Auditor */}
          <div className="feature-card" style={{ textAlign: 'center', padding: '32px 24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Search size={48} color="var(--primary-color)" /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>Employment Letter Auditor</h3>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-color)', margin: '12px 0 4px' }}>
              $24.90 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>CAD</span>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.88rem' }}>
              One-time purchase. One full letter audit.
            </p>
            <ul style={{ listStyleType: 'none', padding: 0, margin: '0 0 24px 0', display: 'grid', gap: '10px', textAlign: 'left', fontSize: '0.88rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Upload existing letters (PDF/Word)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Automatic duty extraction</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> NOC confidence scoring</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981"/> Re-write suggestions for gaps</li>
            </ul>
            <div style={{ marginTop: 'auto' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('audit-employment-letter')} style={{ width: '100%' }}>
                Audit My Letter
              </button>
            </div>
          </div>

        </div>
      </section>
      {/* Testimonials */}
      <Testimonials />

      {/* Free Tools */}
      <section className="section">
        <h2 className="section-title">Free Tools &amp; Resources</h2>
        <p className="section-subtitle">Use these tools at no cost — no payment required.</p>
        <div className="steps-grid">
          <div className="step-card" onClick={() => onNavigate('find-my-noc')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">🎯</div>
            <h3>NOC Finder <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>AI matches your job duties to the correct NOC 2021 code. Analyzes all 516 unit groups in seconds.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('crs-calculator')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">🧮</div>
            <h3>CRS Calculator <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>Calculate your exact Comprehensive Ranking System score based on the official IRCC formula. Instant results.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('cec-checklist')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">✅</div>
            <h3>CEC Checklist <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>Interactive checklist to track every document and requirement for your Canadian Experience Class application.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('express-entry-cec-guide')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">📘</div>
            <h3>CEC Guide <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>Complete step-by-step guide to the Canadian Experience Class program — eligibility, timeline, and tips.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('glossary')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">📖</div>
            <h3>Immigration Glossary <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>70+ Express Entry and immigration terms explained in plain language. Searchable and always up to date.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('noc-codes')} style={{ cursor: 'pointer' }}>
            <div className="step-icon">📂</div>
            <h3>NOC Directory <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>FREE</span></h3>
            <p>Browse all 516 NOC 2021 codes with official duties, TEER categories, and Express Entry eligibility status.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-dark">
        <h2 className="section-title">Common Questions</h2>
        <div className="faq-list">
          <details className="faq-item">
            <summary>What happens if I choose the wrong NOC code?</summary>
            <p>If the duties on your employment letter don't match the NOC code you claim, IRCC can refuse your application. You may lose your filing fee ($1,365 CAD for a single applicant) and have to re-apply, which can set you back months.</p>
          </details>
          <details className="faq-item">
            <summary>Why can't I just use my job title to find my NOC?</summary>
            <p>Job titles vary wildly between companies. "Project Coordinator" at one company might involve completely different duties than at another. IRCC officers match based on your actual duties, not your title. That's why duty-based matching is the only reliable approach.</p>
          </details>
          <details className="faq-item">
            <summary>How does the AI match my NOC code?</summary>
            <p>Our AI reads the duties from your employment letter (or pasted text) and compares them against the official duties of all 516 NOC 2021 unit groups. It returns the best match with a confidence score and shows you exactly which of your duties align with which official NOC duties.</p>
          </details>
          <details className="faq-item">
            <summary>What TEER categories qualify for Express Entry CEC?</summary>
            <p>The Canadian Experience Class (CEC) requires work experience in TEER 0, 1, 2, or 3 occupations. TEER 4 and 5 are generally not eligible for CEC. Our tool automatically identifies your TEER category and tells you if you're eligible.</p>
          </details>
          <details className="faq-item">
            <summary>Is this a replacement for an immigration consultant?</summary>
            <p>No. This tool is purpose-built for one thing: finding your correct NOC code based on your duties. For complex immigration cases, consult a licensed RCIC. But for straightforward NOC matching, this gives you the same answer in seconds instead of waiting days for a consultation.</p>
          </details>
          <details className="faq-item">
            <summary>Can I try before I buy?</summary>
            <p>The NOC Finder tool is completely free for signed-in users. For the Employment Letter Auditor, you'll see a preview of your results before purchasing. The full audit — including compliance checks, duty coverage, and PFL risk assessment — is unlocked with a one-time $24.90 CAD payment.</p>
          </details>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section cta-section">
        <h2 className="cta-title">
          Stop Guessing Your NOC Code.
        </h2>
        <p className="cta-subtitle">
          One wrong code can cost you your PR application. 
          Find the right one in 30 seconds.
        </p>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate('find-my-noc')}>
          Find My NOC Code Now
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Mentor Visa" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
            <span>Mentor Visa</span>
          </div>
          <div className="landing-footer-links">
            <button onClick={() => onNavigate('audit-employment-letter')}>Audit Employment Letter</button>
            <button onClick={() => onNavigate('find-my-noc')}>Find My NOC</button>
            <button onClick={() => onNavigate('crs-calculator')}>CRS Calculator</button>
            <button onClick={() => onNavigate('cec-checklist')}>CEC Application Checklist</button>
            <button onClick={() => onNavigate('build-employment-letter')}>Employment Letter Builder</button>
            <button onClick={() => onNavigate('glossary')}>Immigration Glossary</button>
            <button onClick={() => onNavigate('noc-codes')}>NOC Directory</button>
          </div>
          <p className="landing-footer-disclaimer">
            © 2026 Mentor Visa Services. All rights reserved.<br />
            This tool is for informational purposes only and does not constitute legal or immigration advice.
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
            <a href="/privacy-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms-of-service" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</a>
            <a href="/refund-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
