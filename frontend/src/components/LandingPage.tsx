import type { FC } from 'react';
import { Navbar } from './common/Navbar';
import { SEO } from './common/SEO';
import { Testimonials } from './ui/testimonials-columns-1';
import { CheckCircle2, Search, LineChart, FileText, DollarSign, ShieldCheck, ArrowRight, TrendingDown, Bot, FileCheck, CalendarClock, FolderCheck, BarChart3, Calculator } from 'lucide-react';
import { ALL_DRAWS } from '../data/drawResults';
import './LandingPage.css';
import './PricingPage.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onNavigate: (page: string) => void;
}

// Get the latest non-PNP draw for a meaningful CRS cutoff
const getLatestGeneralDraw = () => {
  const draw = ALL_DRAWS.find(d => d.drawType === 'CEC' || d.drawType === 'General');
  if (!draw) return null;
  const date = new Date(draw.date);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { score: draw.crsScore, date: formatted, type: draw.drawType };
};

const faqSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is Mentor Visa a replacement for an immigration consultant?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No — and that's the point. We cover everything a consultant does in the first $300 consultation: eligibility checks, CRS calculation, NOC matching, and document preparation. For complex legal cases, we recommend a licensed RCIC. But for straightforward Express Entry applications, most people don't need one."
      }
    },
    {
      "@type": "Question",
      "name": "What do I get for free vs. paid?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Eligibility Check, CRS Calculator, NOC Finder, and 12 Mistakes Guide are completely free. The Optimize plan ($49) adds 20 AI Assistant question credits, unlimited employment letter audits, a personalized document checklist with expiry tracking, the CRS point simulator, and 1 free GCMS notes order. The Execute plan ($99) includes everything plus unlimited Express Entry AI Assistant access and priority early access to new features."
      }
    },
    {
      "@type": "Question",
      "name": "How accurate is the AI NOC matching?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our AI cross-references your job duties against the official duties of all 516 NOC 2021 unit groups — the exact same comparison an IRCC officer performs. It returns a confidence score and duty-by-duty alignment breakdown so you can verify every match yourself."
      }
    }
  ]
});

export const LandingPage: FC<LandingPageProps> = ({ onNavigate }) => {
  const latestDraw = getLatestGeneralDraw();

  return (
    <div className="landing">
      <SEO 
        title="Canada PR Platform — Your Complete DIY Express Entry Toolkit | Mentor Visa" 
        description="Check eligibility, calculate CRS, find your NOC code, and track every document. Everything a consultant covers in the first $300 consultation — free. The smarter first step to Canadian PR."
        keywords="Canada PR, Express Entry, CRS calculator, NOC code finder, immigration DIY, eligibility assessment, document tracker"
        canonical="/"
        schema={faqSchema}
      />
      <Navbar />

      {/* ═══════════════════════════════════════════ */}
      {/* HERO — Single CTA, outcome-focused          */}
      {/* ═══════════════════════════════════════════ */}
      <section className="hero relative overflow-hidden">
        <div className="hero-content relative z-10">
          {/* Social Proof Pill */}
          <div className="trust-pill">
            <div className="trust-pill-avatars">
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=48&auto=format&fit=crop" alt="" />
              <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=48&auto=format&fit=crop" alt="" />
              <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=48&auto=format&fit=crop" alt="" />
              <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=48&auto=format&fit=crop" alt="" />
            </div>
            <span className="trust-pill-stars">★★★★★</span>
            <span>2,847 applicants trust Mentor Visa</span>
          </div>

          <h1 className="hero-title">
            Get Canadian PR Without<br />
            <span className="hero-highlight">a $5,000 Consultant.</span>
          </h1>
          <p className="hero-subtitle">
            Check eligibility, calculate your exact CRS, find your NOC code, audit your employment letter, and track every milestone after your ITA — eight tools in one platform. The smarter first step before hiring anyone.
          </p>

          {/* Single Primary CTA */}
          <div className="hero-actions" style={{ flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-primary btn-lg" id="hero-cta-primary" onClick={() => onNavigate('find-my-noc')} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', padding: '16px 36px' }}>
              <Search size={20} /> Find My NOC Code — Free
            </button>
            <button className="btn-ghost" onClick={() => onNavigate('audit-employment-letter')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
              or Audit My Employment Letter <ArrowRight size={14} />
            </button>
          </div>

          {/* Live Draw Urgency Badge */}
          {latestDraw && (
            <div className="urgency-badge" onClick={() => onNavigate('draw-results')} style={{ cursor: 'pointer' }}>
              <TrendingDown size={16} />
              <span>Latest {latestDraw.type} cutoff: <strong>{latestDraw.score} CRS</strong> — {latestDraw.date}</span>
              <ArrowRight size={14} />
            </div>
          )}

          {/* Stats Bar */}
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-number">2,847+</div>
              <div className="hero-stat-label">Applicants</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-number">8</div>
              <div className="hero-stat-label">Tools, One Platform</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-number">2,000+</div>
              <div className="hero-stat-label">Real Cases Behind Predictions</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* CONSULTANT COMPARISON — Positioning          */}
      {/* ═══════════════════════════════════════════ */}
      <section className="section" id="comparison">
        <h2 className="section-title">The Smarter First Step</h2>
        <p className="section-subtitle">Everything a consultant covers in the first $300 consultation — and more.</p>
        
        <div className="comparison-grid-landing">
          {/* Consultant Column */}
          <div className="comparison-col comparison-col-consultant">
            <div className="comparison-col-header consultant">
              <DollarSign size={24} />
              <h3>Immigration Consultant</h3>
            </div>
            <ul className="comparison-list">
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>$2,000–$5,000+ in fees</span>
              </li>
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>2–4 week wait for first meeting</span>
              </li>
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>Manual document review</span>
              </li>
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>One person's opinion on your NOC</span>
              </li>
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>You still gather all documents yourself</span>
              </li>
              <li className="comparison-item negative">
                <span className="comparison-icon negative">✗</span>
                <span>No CRS optimization simulation</span>
              </li>
            </ul>
          </div>

          {/* Mentor Visa Column */}
          <div className="comparison-col comparison-col-mentor">
            <div className="comparison-col-header mentor">
              <ShieldCheck size={24} />
              <h3>Mentor Visa</h3>
              <span className="comparison-badge">From $0</span>
            </div>
            <ul className="comparison-list">
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>Free to start, $49–$99 for full toolkit</span>
              </li>
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>Results in 30 seconds</span>
              </li>
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>AI-powered letter auditing</span>
              </li>
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>Cross-references all 516 NOC codes</span>
              </li>
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>Guided document tracker with expiry alerts</span>
              </li>
              <li className="comparison-item positive">
                <span className="comparison-icon positive">✓</span>
                <span>CRS point simulator with "what-if" scenarios</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="comparison-disclaimer">
          We don't replace your consultant. We make sure you don't need one for 90% of the work.
        </p>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* TOOLKIT — Every tool in the platform         */}
      {/* ═══════════════════════════════════════════ */}
      <section className="section" id="toolkit">
        <h2 className="section-title">One Platform, Every Step of Express Entry</h2>
        <p className="section-subtitle">Eight purpose-built tools that take you from "Am I eligible?" all the way to eCoPR.</p>

        <div className="toolkit-grid">
          {[
            { icon: <CheckCircle2 size={22} />, name: 'Eligibility Check', desc: 'Answer 5 questions to see if you qualify for FSWP, CEC, or FSTP.', tier: 'Free', page: 'get-started' },
            { icon: <Calculator size={22} />, name: 'CRS Calculator & Simulator', desc: 'Your exact score, the gap to the latest cutoff, and what-if point scenarios.', tier: 'Free', page: 'crs-calculator' },
            { icon: <Search size={22} />, name: 'NOC Code Finder', desc: 'AI matches your duties against all 516 NOC 2021 unit groups with a confidence score.', tier: 'Free', page: 'find-my-noc' },
            { icon: <FileCheck size={22} />, name: 'Employment Letter Auditor', desc: 'An IRCC-style, duty-by-duty audit of your reference letter before you submit.', tier: 'Optimize', page: 'audit-employment-letter' },
            { icon: <Bot size={22} />, name: 'AI Profile Assistant', desc: 'Personalized answers and a tailored action plan to raise your CRS.', tier: 'Optimize', page: 'ai-profile-assistant' },
            { icon: <CalendarClock size={22} />, name: 'Smart Application Tracker', desc: 'Track every post-ITA milestone and get timeline predictions from 2,000+ real cases.', tier: 'Optimize', page: 'track-my-application' },
            { icon: <FolderCheck size={22} />, name: 'Document Checklist & Expiry Tracker', desc: 'A personalized checklist with expiry alerts for you and your dependents.', tier: 'Optimize', page: 'documents' },
            { icon: <BarChart3 size={22} />, name: 'Draws & Processing Times', desc: 'Every recent Express Entry draw plus real-world processing-time data.', tier: 'Free', page: 'draw-results' },
          ].map((t) => (
            <div key={t.name} className="tool-card" onClick={() => onNavigate(t.page)}>
              <div className="tool-card-top">
                <span className="tool-card-icon">{t.icon}</span>
                <span className={`tool-card-tier ${t.tier === 'Free' ? 'free' : 'paid'}`}>{t.tier}</span>
              </div>
              <h3 className="tool-card-name">{t.name}</h3>
              <p className="tool-card-desc">{t.desc}</p>
              <span className="tool-card-link">Open <ArrowRight size={13} /></span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* HOW IT WORKS — Benefit-driven 5 steps       */}
      {/* ═══════════════════════════════════════════ */}
      <section id="how-it-works" className="section section-dark">
        <h2 className="section-title">Your PR Journey, End to End</h2>
        <p className="section-subtitle">From "Am I eligible?" to confirmation of PR — everything in one place.</p>
        <div className="steps-grid">
          <div className="step-card" onClick={() => onNavigate('get-started')} style={{ cursor: 'pointer' }}>
            <div className="step-number">1</div>
            <div className="step-icon"><CheckCircle2 size={32} color="var(--primary-color)" /></div>
            <h3>Am I Even Eligible?</h3>
            <p>Answer 5 questions. Know in 2 minutes if you qualify for FSWP, CEC, or FSTP — and which one gives you the best shot.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('crs-calculator')} style={{ cursor: 'pointer' }}>
            <div className="step-number">2</div>
            <div className="step-icon"><LineChart size={32} color="var(--primary-color)" /></div>
            <h3>What's My Real Score?</h3>
            <p>Get your exact CRS score, see how far you are from the latest cutoff, and discover which improvements gain you the most points.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('find-my-noc')} style={{ cursor: 'pointer' }}>
            <div className="step-number">3</div>
            <div className="step-icon"><Search size={32} color="var(--primary-color)" /></div>
            <h3>Is My NOC Code Right?</h3>
            <p>Upload your employment letter. Our AI matches your duties against all 516 NOC codes — the same check an IRCC officer does.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('documents')} style={{ cursor: 'pointer' }}>
            <div className="step-number">4</div>
            <div className="step-icon"><FileText size={32} color="var(--primary-color)" /></div>
            <h3>Are My Documents Ready?</h3>
            <p>Build a personalized checklist for you and your dependents, with expiry alerts so nothing lapses before you submit.</p>
          </div>
          <div className="step-card" onClick={() => onNavigate('track-my-application')} style={{ cursor: 'pointer' }}>
            <div className="step-number">5</div>
            <div className="step-icon"><CalendarClock size={32} color="var(--primary-color)" /></div>
            <h3>When Will I Hear Back?</h3>
            <p>After your ITA, track each milestone and get timeline predictions — biometrics, medical, P1/P2 or PPR, and eCoPR — from 2,000+ real cases.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* PRICING — Simplified, 1 benefit per plan     */}
      {/* ═══════════════════════════════════════════ */}
      <section className="section" style={{ background: 'var(--bg-color)' }}>
        <div className="pricing-header" style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Simple, One-Time Pricing</h2>
          <p className="pricing-subtitle">No subscriptions. No hidden fees. Start free, upgrade when you're ready.</p>
        </div>
        
        <div className="pricing-grid" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Free</h3>
              <div className="pricing-price">$0</div>
              <p className="pricing-desc">Everything you need to start</p>
            </div>
            <ul className="pricing-features">
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>Eligibility Assessment</span></li>
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>CRS Calculator — unlimited</span></li>
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>NOC Finder — 2 free reports</span></li>
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>12 Mistakes Guide</span></li>
            </ul>
            <div className="pricing-card-footer">
              <button className="pricing-btn free" onClick={() => onNavigate('get-started')}>Start Free</button>
            </div>
          </div>

          {/* Optimize */}
          <div className="pricing-card featured">
            <div className="pricing-popular-badge">⭐ BEST VALUE</div>
            <div className="pricing-card-header">
              <h3>Optimize</h3>
              <div className="pricing-price">$49 <span>CAD</span></div>
              <p className="pricing-desc">Audit your employment letters and track expirations.</p>
            </div>
            <ul className="pricing-features">
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>Everything in Explore</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Unlimited NOC Finder</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Unlimited Employment Letter Audits</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Smart Post-ITA Milestone Tracker &amp; Predictor</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Unlimited CRS Point Simulator (What-If Scenarios)</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>20 Question Credits - Express Entry AI Assistant</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Personalized Document Checklist</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Document Expiry Tracker</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>1 Free GCMS Notes Order ($19.90 value)</span></li>
            </ul>
            <div className="pricing-card-footer">
              <button className="pricing-btn primary" onClick={() => onNavigate('pricing')}>Get Optimize — $49</button>
            </div>
          </div>

          {/* Execute */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Execute</h3>
              <div className="pricing-price">$99 <span>CAD</span></div>
              <p className="pricing-desc">Your complete AI toolkit for absolute peace of mind.</p>
            </div>
            <ul className="pricing-features">
              <li className="pricing-feature"><CheckCircle2 size={16} className="feature-check" /><span>Everything in Optimize</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Unlimited Express Entry AI Assistant</span></li>
              <li className="pricing-feature highlight"><CheckCircle2 size={16} className="feature-check" /><span>Priority Early Access to Features</span></li>
            </ul>
            <div className="pricing-card-footer">
              <button className="pricing-btn secondary" onClick={() => onNavigate('pricing')}>Get Execute — $99</button>
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={() => onNavigate('pricing')} style={{ padding: '10px 24px' }}>
            Compare Full Features →
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* SOCIAL PROOF — Testimonials                  */}
      {/* ═══════════════════════════════════════════ */}
      <Testimonials />

      {/* ═══════════════════════════════════════════ */}
      {/* FAQ — 3 platform-wide questions              */}
      {/* ═══════════════════════════════════════════ */}
      <section className="section section-dark">
        <h2 className="section-title">Common Questions</h2>
        <div className="faq-list">
          <details className="faq-item">
            <summary>Is this a replacement for an immigration consultant?</summary>
            <p>No — and that's the point. We cover everything a consultant does in the first $300 consultation: eligibility checks, CRS calculation, NOC matching, and document preparation. For complex legal cases, we always recommend a licensed RCIC. But for straightforward Express Entry applications, most people don't need one.</p>
          </details>
          <details className="faq-item">
            <summary>What do I get for free vs. paid?</summary>
            <p>The Eligibility Check, CRS Calculator, NOC Finder, and 12 Mistakes Guide are completely free — no payment required. The Optimize plan ($49 CAD) adds 20 AI Assistant question credits, unlimited employment letter audits, a personalized document checklist with expiry tracking, the CRS point simulator, and 1 free GCMS notes order. The Execute plan ($99 CAD) includes everything plus unlimited Express Entry AI Assistant access and priority early access to new features.</p>
          </details>
          <details className="faq-item">
            <summary>How accurate is the AI NOC matching?</summary>
            <p>Our AI cross-references your job duties against the official duties of all 516 NOC 2021 unit groups — the exact same comparison an IRCC officer performs. It returns a confidence score and duty-by-duty alignment breakdown so you can verify every match yourself. For straightforward roles, it matches what a consultant would tell you — in seconds instead of days.</p>
          </details>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* FINAL CTA — Urgency-driven                   */}
      {/* ═══════════════════════════════════════════ */}
      <section className="section cta-section">
        <h2 className="cta-title">
          Every Week You Wait,<br />the CRS Cutoff Could Change.
        </h2>
        <p className="cta-subtitle">
          Find your NOC code now — it takes 2 minutes and it's completely free. You might be closer to PR than you think.
        </p>
        <button className="btn btn-primary btn-lg" id="footer-cta-primary" onClick={() => onNavigate('find-my-noc')}>
          Find My NOC Code — Free
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Mentor Visa" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
            <span>Mentor Visa</span>
          </div>
          {/* Real anchors (not buttons) so crawlers can follow homepage footer links */}
          <div className="landing-footer-links" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/get-started">Check Eligibility</a>
            <a href="/crs-calculator">CRS Calculator</a>
            <a href="/find-my-noc">Find My NOC</a>
            <a href="/audit-employment-letter">Letter Auditor</a>
            <a href="/track-my-application">Application Tracker</a>
            <a href="/order-gcms-notes">Order GCMS Notes</a>
            <a href="/how-to-read-gcms-notes">GCMS Notes Guide</a>
            <a href="/draw-results">Draw Results</a>
            <a href="/express-entry-processing-times">Processing Times</a>
            <a href="/noc-codes">NOC Directory</a>
            <a href="/glossary">Glossary</a>
            <a href="/pricing">Pricing</a>
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

      {/* Mobile Sticky CTA */}
      <div className="sticky-mobile-cta">
        <button className="btn btn-primary" onClick={() => onNavigate('find-my-noc')} style={{ width: '100%', padding: '14px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Search size={18} /> Find My NOC Code — Free
        </button>
      </div>
    </div>
  );
};
