import type { FC } from 'react';
import { SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/clerk-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onGetStarted }) => {
  const { isSignedIn } = useAuth();

  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="landing-logo-icon">🍁</span>
            <span className="landing-logo-text">Mentor Visa</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.95rem' }}>Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.95rem' }}>Sign Up</button>
                </SignUpButton>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={onGetStarted} style={{ padding: '8px 16px', fontSize: '0.95rem' }}>
                  Audit My Document
                </button>
                <UserButton />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🤖 Powered by AI &amp; Official NOC 2021 Database</div>
          <h1 className="hero-title">
            Don't Let a Small Mistake<br />
            <span className="hero-highlight">Cost You Your PR</span>
          </h1>
          <p className="hero-subtitle">
            Get your Express Entry employment letter instantly audited against official IRCC requirements and all 516 NOC 2021 codes — before the officer reviews it.
          </p>
          <div className="hero-actions" style={{ marginBottom: '24px' }}>
            <button className="btn btn-primary btn-lg" onClick={onGetStarted}>
              Audit My Document — Free
            </button>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              See How It Works ↓
            </a>
          </div>

          <div className="hero-trust-badges">
            <div className="trust-badge">
              <div className="trust-avatars">
                <img src="https://i.pravatar.cc/100?img=1" alt="user" />
                <img src="https://i.pravatar.cc/100?img=2" alt="user" />
                <img src="https://i.pravatar.cc/100?img=3" alt="user" />
                <img src="https://i.pravatar.cc/100?img=4" alt="user" />
              </div>
              <div className="trust-stars">
                ⭐⭐⭐⭐⭐
              </div>
              <span className="trust-text"><strong>4.9/5 Match accuracy</strong> rated by 10,000+ Express Entry applicants.</span>
            </div>
            
            <div className="trust-badge badge-secondary">
              <div className="trust-icon-check">✓</div>
              <span className="trust-text"><strong>Calibrated by Regulated Canadian Immigration Consultants (RCIC).</strong> Generates an IRCC-ready NOC Alignment Sheet to expedite your officer's review.</span>
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
              <div className="hero-stat-label">Official Duties Matched</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-number">9</div>
              <div className="hero-stat-label">IRCC Criteria Checked</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Three simple steps to a bulletproof employment letter</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon">📄</div>
            <h3>Upload Your Letter</h3>
            <p>Drop your employment reference letter in any format — PDF, Word, or even a photo of the document.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">🔍</div>
            <h3>AI Analyzes Everything</h3>
            <p>Our AI reads your letter, auto-detects the matching NOC code, and audits it against all 9 IRCC mandatory requirements.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon">✅</div>
            <h3>Get Your Report</h3>
            <p>Receive a detailed compliance report with risks, missing elements, and suggested fixes — in seconds, not days.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section-dark">
        <h2 className="section-title">What Makes Us Different</h2>
        <p className="section-subtitle">Built specifically for Canadian Experience Class applicants</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Automatic NOC Detection</h3>
            <p>No need to know your NOC code. Our AI reads your duties and matches them against all 516 unit groups in the official NOC 2021 database.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3>9-Point IRCC Checklist</h3>
            <p>We check for every mandatory element IRCC requires: letterhead, dates, hours, salary, duties, signatory, and more.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👁️</div>
            <h3>Sees Your Actual Document</h3>
            <p>Our hybrid AI reads both the text and the visual layout — it can verify your company logo, letterhead, and signature are present.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✍️</div>
            <h3>Suggested Wording</h3>
            <p>Get AI-recommended improvements to your duty descriptions that better align with NOC requirements — without copy-pasting from the NOC guide.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📎</div>
            <h3>Any Format Accepted</h3>
            <p>Upload PDF, Word (.docx), or image files. Scanned documents and photos of letters work too — our vision AI reads them all.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Private & Secure</h3>
            <p>Your documents are processed in real-time and never stored on our servers. Your personal information stays private.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          <details className="faq-item">
            <summary>What is a NOC code and why does it matter?</summary>
            <p>The National Occupational Classification (NOC) is Canada's system for classifying jobs. For Express Entry (CEC), your employment letter must demonstrate duties that align with your claimed NOC code. A mismatch can lead to application refusal.</p>
          </details>
          <details className="faq-item">
            <summary>Do I need to know my NOC code before using this tool?</summary>
            <p>No! Our AI automatically reads the duties in your employment letter and identifies the best-matching NOC 2021 code from all 516 unit groups. You don't need to look anything up.</p>
          </details>
          <details className="faq-item">
            <summary>What elements does IRCC require in an employment letter?</summary>
            <p>IRCC requires: company letterhead, your full name, company contact information, job title, employment dates, hours per week, salary/compensation, detailed duties, and a signatory (supervisor or HR officer).</p>
          </details>
          <details className="faq-item">
            <summary>Is my document stored on your servers?</summary>
            <p>No. Your document is processed in real-time by our AI and is never saved or stored. Once you close the page, the data is gone.</p>
          </details>
          <details className="faq-item">
            <summary>Does this replace an immigration consultant?</summary>
            <p>No. This tool is designed to help you catch common issues before you submit your application. It is not legal advice. We recommend consulting a licensed RCIC or immigration lawyer for complex cases.</p>
          </details>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section cta-section">
        <h2 className="cta-title">
          Get Your Employment Letter<br />
          Audited Before IRCC Does
        </h2>
        <p className="cta-subtitle">
          A missing element or duty mismatch in your employment letter can delay or even derail your Express Entry application. 
          Catch issues before IRCC does.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onGetStarted}>
          Audit My Document Now — Free
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-icon">🍁</span>
            <span>Mentor Visa</span>
          </div>
          <p className="landing-footer-disclaimer">
            © 2026 Mentor Visa Services. All rights reserved.<br />
            This tool is for informational purposes only and does not constitute legal or immigration advice.
          </p>
        </div>
      </footer>
    </div>
  );
};
