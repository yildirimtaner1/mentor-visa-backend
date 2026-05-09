import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from './common/SEO';
import './GCKeyGuidePage.css';

const schema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Set Up a GCKey Account for Express Entry",
  "description": "Step-by-step guide to creating your GCKey account to access the IRCC Express Entry portal for Canadian permanent residency.",
  "totalTime": "PT10M",
  "step": [
    { "@type": "HowToStep", "position": 1, "name": "Go to the IRCC Sign-In Page", "text": "Visit canada.ca and navigate to the immigration account sign-in page." },
    { "@type": "HowToStep", "position": 2, "name": "Choose GCKey", "text": "Select GCKey as your sign-in method (not Sign-In Partner)." },
    { "@type": "HowToStep", "position": 3, "name": "Click Sign Up", "text": "Click the Sign Up button to create a new GCKey account." },
    { "@type": "HowToStep", "position": 4, "name": "Accept Terms and Conditions", "text": "Read and accept the GCKey Terms and Conditions of Use." },
    { "@type": "HowToStep", "position": 5, "name": "Create Your Username", "text": "Choose a username between 8-16 characters with no spaces." },
    { "@type": "HowToStep", "position": 6, "name": "Create Your Password", "text": "Choose a strong password meeting all the requirements shown on screen." },
    { "@type": "HowToStep", "position": 7, "name": "Set Up Recovery Questions", "text": "Select and answer security/recovery questions for account recovery." },
    { "@type": "HowToStep", "position": 8, "name": "Link to IRCC", "text": "After creating your GCKey, link it to IRCC online services to access Express Entry." }
  ]
});

export const GCKeyGuidePage: FC = () => {
  return (
    <div>
      <SEO
        title="How to Set Up a GCKey Account for Express Entry (2025 Guide) | Mentor Visa"
        description="Step-by-step guide with screenshots to create your GCKey account and access the IRCC Express Entry portal. Takes less than 10 minutes."
        keywords="GCKey setup, GCKey account, IRCC sign in, Express Entry account, Canada immigration login, GCKey registration"
        canonical="/gckey-setup-guide"
        schema={schema}
      />

      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🔑 Account Setup</div>
          <h1>How to Set Up a GCKey Account<br /><span className="hero-highlight">for Express Entry</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Before you can create an Express Entry profile, you need a GCKey — the official login credential for
            Canadian government immigration services. This guide walks you through every step.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⏱️ <span style={{ color: 'var(--primary-light)' }}>Takes ~10 minutes</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📋 22 Visual Steps</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🆓 Completely free</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <div className="gckey-layout">

          {/* Table of Contents Sidebar */}
          <aside className="gckey-toc">
            <div className="gckey-toc-title">On This Page</div>
            <a href="#what-is-gckey" className="gckey-toc-link">What is GCKey?</a>
            <a href="#gckey-vs-signin" className="gckey-toc-link">GCKey vs Sign-In Partner</a>
            <a href="#step-1" className="gckey-toc-link">Step 1: Go to IRCC</a>
            <a href="#step-2" className="gckey-toc-link">Step 2: Choose GCKey</a>
            <a href="#step-3" className="gckey-toc-link">Step 3: Click Sign Up</a>
            <a href="#step-4" className="gckey-toc-link">Step 4: Accept Terms</a>
            <a href="#step-5" className="gckey-toc-link">Step 5: Create Username</a>
            <a href="#step-6" className="gckey-toc-link">Step 6: Create Password</a>
            <a href="#step-7" className="gckey-toc-link">Step 7: Recovery Questions</a>
            <a href="#step-8" className="gckey-toc-link">Step 8: Email Recovery</a>
            <a href="#step-9" className="gckey-toc-link">Step 9: Sign Up Complete</a>
            <a href="#step-10" className="gckey-toc-link">Step 10: Confirm Email</a>
            <a href="#step-11" className="gckey-toc-link">Step 11: Email Recovery Complete</a>
            <a href="#step-12" className="gckey-toc-link">Step 12: Welcome Screen</a>
            <a href="#step-13" className="gckey-toc-link">Step 13: Two-Factor Authentication</a>
            <a href="#step-14" className="gckey-toc-link">Step 14: Accept 2FA Terms</a>
            <a href="#step-15" className="gckey-toc-link">Step 15: Register 2FA Email</a>
            <a href="#step-16" className="gckey-toc-link">Step 16: Verify 2FA Email</a>
            <a href="#step-17" className="gckey-toc-link">Step 17: Save Recovery Codes</a>
            <a href="#step-18" className="gckey-toc-link">Step 18: 2FA Complete</a>
            <a href="#step-19" className="gckey-toc-link">Step 19: IRCC Terms</a>
            <a href="#step-20" className="gckey-toc-link">Step 20: Create IRCC Profile</a>
            <a href="#step-21" className="gckey-toc-link">Step 21: IRCC Security Questions</a>
            <a href="#step-22" className="gckey-toc-link">Step 22: IRCC Dashboard</a>
            <a href="#troubleshooting" className="gckey-toc-link">Troubleshooting</a>
            <a href="#whats-next" className="gckey-toc-link">What's Next?</a>
          </aside>

          {/* Main Content */}
          <main className="gckey-main">

            {/* What is GCKey? */}
            <section id="what-is-gckey" className="gckey-section">
              <h2>🔑 What is GCKey?</h2>
              <p>
                GCKey is a <strong>free username and password</strong> issued by the Government of Canada. It's your login credential to
                access IRCC (Immigration, Refugees and Citizenship Canada) online services — including the Express Entry system.
              </p>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">💡</span>
                <div>
                  <strong>You need a GCKey to:</strong>
                  <ul>
                    <li>Create an Express Entry profile</li>
                    <li>Submit your permanent residency application</li>
                    <li>Check the status of your application</li>
                    <li>Respond to requests from IRCC</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* GCKey vs Sign-In Partner */}
            <section id="gckey-vs-signin" className="gckey-section">
              <h2>🤔 GCKey vs. Sign-In Partner — Which Should You Choose?</h2>
              <p>When you go to sign in to IRCC, you'll see two options. Here's the difference:</p>
              <div className="gckey-comparison">
                <div className="gckey-compare-card recommended">
                  <div className="gckey-compare-badge">✅ Recommended</div>
                  <h3>GCKey</h3>
                  <ul>
                    <li>Government-issued credential</li>
                    <li>Works for everyone worldwide</li>
                    <li>No bank account needed</li>
                    <li>Most commonly used for Express Entry</li>
                  </ul>
                </div>
                <div className="gckey-compare-card">
                  <h3>Sign-In Partner</h3>
                  <ul>
                    <li>Uses your Canadian bank login</li>
                    <li>Only works with supported banks</li>
                    <li>Requires a Canadian bank account</li>
                    <li>Less common for overseas applicants</li>
                  </ul>
                </div>
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">📌</span>
                <div>
                  <strong>Our recommendation:</strong> Use GCKey. It works regardless of where you're applying from, and it's what the vast majority of Express Entry applicants use.
                </div>
              </div>
            </section>

            {/* Step 1 */}
            <section id="step-1" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">1</div>
                <h2>Go to the IRCC Sign-In Page</h2>
              </div>
              <p>
                Open your browser and go to the official IRCC account page:
              </p>
              <div className="gckey-url-box">
                <code>https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html</code>
                <button
                  className="gckey-copy-btn"
                  onClick={() => navigator.clipboard.writeText('https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html')}
                >
                  📋 Copy
                </button>
              </div>
              {/* Screenshot */}
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step1-ircc-account.png" alt="IRCC account page showing GCKey and Sign-In Partner options" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">⚠️</span>
                <div>
                  <strong>Beware of fake websites.</strong> Always make sure the URL starts with <code>canada.ca</code> or <code>gc.ca</code>.
                  Never enter your GCKey credentials on any other website.
                </div>
              </div>
            </section>

            {/* Step 2 */}
            <section id="step-2" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">2</div>
                <h2>Choose GCKey</h2>
              </div>
              <p>
                On the IRCC account page, you'll see two large buttons. Click <strong>"GCKey"</strong> (not "Sign-In Partner").
                This will take you to the GCKey login page.
              </p>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step2-choose-option.png" alt="IRCC registration page showing GCKey vs Sign-In Partner options" />
              </div>
            </section>

            {/* Step 3 */}
            <section id="step-3" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">3</div>
                <h2>Click "Sign Up"</h2>
              </div>
              <p>
                You'll land on the GCKey login page. Since you don't have an account yet, look for the <strong>"Sign Up"</strong> button
                below the sign-in form and click it.
              </p>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step3-signup-button.png" alt="GCKey Welcome page with Sign Up button on the right" />
              </div>
            </section>

            {/* Step 4 */}
            <section id="step-4" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">4</div>
                <h2>Accept the Terms and Conditions</h2>
              </div>
              <p>
                You'll be shown the GCKey Terms and Conditions of Use. Scroll down and read them, then click
                <strong> "I Accept"</strong> to continue.
              </p>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step4-terms.png" alt="GCKey Terms and Conditions page - Step 1 of 5" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">ℹ️</span>
                <div>
                  This is a standard government terms of service agreement. It covers how your GCKey credentials will be used and your responsibilities for keeping them secure.
                </div>
              </div>
            </section>

            {/* Step 5 */}
            <section id="step-5" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">5</div>
                <h2>Create Your Username</h2>
              </div>
              <p>Choose a username for your GCKey account. The requirements are:</p>
              <div className="gckey-requirements">
                <div className="gckey-req-item">✅ Between 8 and 16 characters</div>
                <div className="gckey-req-item">✅ Must contain letters</div>
                <div className="gckey-req-item">✅ No spaces or special characters</div>
                <div className="gckey-req-item">✅ Cannot be the same as your password</div>
              </div>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step5-username.png" alt="GCKey Create Your Username page - Step 2 of 5" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">💡</span>
                <div>
                  <strong>Tip:</strong> Write down your username somewhere safe. You'll need it every time you log in to check your Express Entry status or respond to IRCC requests. Consider using a password manager.
                </div>
              </div>
            </section>

            {/* Step 6 */}
            <section id="step-6" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">6</div>
                <h2>Create Your Password</h2>
              </div>
              <p>Choose a strong password. The requirements are strict:</p>
              <div className="gckey-requirements">
                <div className="gckey-req-item">✅ Between 8 and 16 characters</div>
                <div className="gckey-req-item">✅ At least 1 uppercase letter (A–Z)</div>
                <div className="gckey-req-item">✅ At least 1 lowercase letter (a–z)</div>
                <div className="gckey-req-item">✅ At least 1 number (0–9)</div>
                <div className="gckey-req-item">✅ No spaces</div>
                <div className="gckey-req-item">✅ Cannot be the same as your username</div>
              </div>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step6-password.png" alt="GCKey Create Your Password page - Step 3 of 5" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">⚠️</span>
                <div>
                  <strong>Do NOT lose your password.</strong> If you lose access to your GCKey during your Express Entry process,
                  recovering it can be extremely stressful — especially if you have a pending ITA with a 60-day deadline.
                  Store your credentials in a password manager.
                </div>
              </div>
            </section>

            {/* Step 7 */}
            <section id="step-7" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">7</div>
                <h2>Set Up Recovery Questions</h2>
              </div>
              <p>
                You'll be asked to select and answer <strong>recovery questions</strong>. These are used to verify your identity
                if you ever need to reset your password.
              </p>
              <div className="gckey-screenshot crop-bg">
                <img src="/screenshots/gckey-step7-recovery.png" alt="GCKey Recovery Questions page - Step 4 of 5" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">💡</span>
                <div>
                  <strong>Tip:</strong> Choose answers you'll remember years from now. Your PR application process can take 6–12 months, and you'll need this account the entire time. Write down your answers and store them with your username and password.
                </div>
              </div>
            </section>

            {/* Step 8 */}
            <section id="step-8" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">8</div>
                <h2>Add Optional Email Recovery</h2>
              </div>
              <p>
                You'll be asked if you want to add an email address for account recovery (Step 5 of 5). This is optional, but highly recommended in case you forget your username or password.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step8-email.png" alt="GCKey Email Recovery page" />
              </div>
              <p>
                Enter your email address and click <strong>"Continue"</strong>, or click <strong>"Skip"</strong> if you prefer not to provide one.
              </p>
            </section>

            {/* Step 9 */}
            <section id="step-9" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">9</div>
                <h2>GCKey Sign Up Complete</h2>
              </div>
              <p>
                Congratulations! You will see a success screen confirming that you have successfully created your GCKey and showing your chosen username.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step9-complete.png" alt="GCKey Sign Up Complete page" />
              </div>
              <p>
                Click <strong>"Continue"</strong> to proceed. If you provided an email address in the previous step, you may be asked to verify it before continuing to the IRCC portal.
              </p>
            </section>

            {/* Step 10 */}
            <section id="step-10" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">10</div>
                <h2>Confirm your Email Address</h2>
              </div>
              <p>
                If you chose to add an email address for account recovery, you will be prompted to enter a confirmation code that was sent to your inbox.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step10-email-confirm.png" alt="GCKey Confirm your Email Address page" />
              </div>
              <p>
                Check your email for the code, enter it in the box, and click <strong>"Continue"</strong>.
              </p>
            </section>

            {/* Step 11 */}
            <section id="step-11" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">11</div>
                <h2>Email Recovery Complete</h2>
              </div>
              <p>
                Once you enter the correct code, you will see a confirmation page stating that you have successfully added the email recovery option.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step11-email-complete.png" alt="GCKey Email Recovery Complete page" />
              </div>
              <p>
                Click <strong>"Continue"</strong>. You have now officially completed the GCKey portion of the signup and will be taken to the IRCC site to link your account.
              </p>
            </section>

            {/* Step 12 */}
            <section id="step-12" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">12</div>
                <h2>Welcome Screen</h2>
              </div>
              <p>
                You will be shown a Welcome screen displaying your username. From here, you can manage your GCKey settings in the future.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step12-welcome.png" alt="GCKey Welcome Screen" />
              </div>
              <p>
                Click <strong>"Continue"</strong> to proceed to two-factor authentication or the IRCC terms and conditions.
              </p>
            </section>

            {/* Step 13 */}
            <section id="step-13" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">13</div>
                <h2>Set Up Two-Factor Authentication</h2>
              </div>
              <p>
                The Government of Canada requires Two-Factor Authentication (2FA) to secure your account. You will be presented with three options: using a smartphone, a desktop device, or an email address.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step13-2fa.png" alt="GCKey Two-Factor Authentication page" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">📌</span>
                <div>
                  <strong>Our Recommendation:</strong> We highly recommend choosing <strong>"Use your email address"</strong>. The smartphone app (authenticator) is easily lost if you upgrade or reset your phone, and the desktop option is tied to a single computer. Using an email address ensures you can securely log in from any device, anywhere in the world.
                </div>
              </div>
              <p>
                Click <strong>"Set up your email"</strong> to proceed with the recommended method.
              </p>
            </section>

            {/* Step 14 */}
            <section id="step-14" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">14</div>
                <h2>Accept 2FA Terms and Conditions</h2>
              </div>
              <p>
                Before finalizing your 2FA method, you must accept the terms and conditions specifically for the two-factor authentication service.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step14-2fa-terms.png" alt="GCKey 2FA Terms and Conditions page" />
              </div>
              <p>
                Read through the agreement and click <strong>"I accept"</strong> to continue setting up your email authenticator.
              </p>
            </section>

            {/* Step 15 */}
            <section id="step-15" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">15</div>
                <h2>Register your email address for 2FA</h2>
              </div>
              <p>
                You will be prompted to enter your email address to use as your second factor. A verification code will be sent to this email every time you log in from a new device.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step15-register-email.png" alt="GCKey Register your email address page" />
              </div>
              <p>
                Enter your email address and click <strong>"Continue"</strong>. You will then receive a one-time passcode to confirm your 2FA setup.
              </p>
            </section>

            {/* Step 16 */}
            <section id="step-16" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">16</div>
                <h2>Verify your email address</h2>
              </div>
              <p>
                A one-time passcode will be sent to the email address you just provided. Check your inbox (and spam folder) for the code.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step16-verify-email-2fa.png" alt="GCKey Verify your email address page" />
              </div>
              <p>
                Enter the passcode into the field and click <strong>"Continue"</strong>. You will use a similar one-time passcode every time you log in to your GCKey.
              </p>
            </section>

            {/* Step 17 */}
            <section id="step-17" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">17</div>
                <h2>Save Your 2FA Recovery Codes</h2>
              </div>
              <p>
                The final step in securing your account is saving your 2FA recovery codes. If you ever lose access to your email or authentication method, these codes are your only way back in.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step17-recovery-codes-1.png" alt="GCKey Recovery Codes List" />
              </div>
              <p>
                Make sure to write these down, print the page, or save them in a secure password manager.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step17-recovery-codes-2.png" alt="GCKey Recovery Codes Checkbox" />
              </div>
              <p>
                Check the box that says <strong>"Yes, I have securely recorded and stored these codes"</strong> and click <strong>"Continue"</strong>.
              </p>
            </section>

            {/* Step 18 */}
            <section id="step-18" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">18</div>
                <h2>2FA Setup Complete</h2>
              </div>
              <p>
                You have successfully secured your account! A final confirmation page will appear letting you know that Two-Factor Authentication is fully active.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step18-2fa-complete.png" alt="GCKey 2FA Setup Complete page" />
              </div>
              <p>
                Click <strong>"Continue"</strong>. You will finally be redirected out of the GCKey system and into the IRCC portal!
              </p>
            </section>

            {/* Step 19 */}
            <section id="step-19" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">19</div>
                <h2>Accept IRCC Terms and Conditions</h2>
              </div>
              <p>
                You are now officially on the IRCC portal. The first thing you must do is read and agree to the IRCC Terms and Conditions of Use.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step19-ircc-terms-1.png" alt="IRCC Terms and Conditions Top" />
              </div>
              <p>
                Scroll through to review the terms detailing how your information will be used and your responsibilities as an applicant.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step19-ircc-terms-2.png" alt="IRCC Terms and Conditions Bottom" />
              </div>
              <p>
                Click <strong>"I Accept"</strong> at the bottom of the page to finalize the linking process.
              </p>
            </section>

            {/* Step 20 */}
            <section id="step-20" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">20</div>
                <h2>Create Your IRCC Profile</h2>
              </div>
              <p>
                You must now provide your personal details to officially establish your identity within the IRCC portal. This information must match your passport exactly.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step20-create-account.png" alt="IRCC Create an account profile form" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">📌</span>
                <div>
                  <strong>IMPORTANT:</strong> Enter your name <em>exactly</em> as it appears in the Machine Readable Zone (the bottom lines) of your passport. Any discrepancies here can cause major delays or rejections later in the application process.
                </div>
              </div>
              <p>
                Fill in your Given Name, Last Name, Email address, and preferred notification language, then click <strong>"Continue"</strong>.
              </p>
            </section>

            {/* Step 21 */}
            <section id="step-21" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">21</div>
                <h2>Create Your IRCC Security Questions</h2>
              </div>
              <p>
                The final step to complete your IRCC account is creating four custom security questions. You will be asked one of these questions every single time you log in to your account.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step21-security-questions.png" alt="IRCC Create security questions form (Top)" />
              </div>
              <div className="gckey-callout">
                <span className="gckey-callout-icon">💡</span>
                <div>
                  <strong>Crucial Tip:</strong> Because you will have to answer one of these randomly upon every login, make the answers simple, easy to spell, and impossible to forget. For example, Question: "1", Answer: "1". Keep it simple!
                </div>
              </div>
              <p>
                Fill out all four questions and answers.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step21-security-questions-2.png" alt="IRCC Create security questions form (Bottom)" />
              </div>
              <p>
                Once all fields are filled, click <strong>"Continue"</strong> to proceed to your new IRCC dashboard.
              </p>
            </section>

            {/* Step 22 */}
            <section id="step-22" className="gckey-section">
              <div className="gckey-step-header">
                <div className="gckey-step-number">22</div>
                <h2>Welcome to Your IRCC Dashboard</h2>
              </div>
              <p>
                Congratulations! You have successfully created your GCKey and registered your official IRCC portal account.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step22-dashboard-1.png" alt="IRCC Secure Account Dashboard Top" />
              </div>
              <p>
                This dashboard is the central hub where you will create your Express Entry profile, upload documents, pay fees, and receive official correspondence from the Canadian Government.
              </p>
              <div className="gckey-screenshot">
                <img src="/screenshots/gckey-step22-dashboard-2.png" alt="IRCC Secure Account Dashboard Start Application" />
              </div>
              <p>
                To begin your Express Entry journey, scroll down to the <strong>"Start an application"</strong> section and click on <strong>"Apply to come to Canada"</strong>.
              </p>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="gckey-section">
              <h2>🛠️ Common Issues & Troubleshooting</h2>

              <details className="gckey-faq-item">
                <summary>"Your session has expired" error</summary>
                <p>
                  The GCKey website has a short session timeout (around 15–20 minutes). If you take too long on any step,
                  your session will expire and you'll need to start over. <strong>Have your username and password ready before you begin.</strong>
                </p>
              </details>

              <details className="gckey-faq-item">
                <summary>"Username already taken" error</summary>
                <p>
                  GCKey usernames are unique across all users. If your preferred username is taken, try adding numbers or using a different variation.
                  For example: <code>JohnSmith2025</code> or <code>JSm1thCanada</code>.
                </p>
              </details>

              <details className="gckey-faq-item">
                <summary>Browser compatibility issues</summary>
                <p>
                  The GCKey website works best with <strong>Chrome, Firefox, or Edge</strong>. If you're experiencing issues,
                  try a different browser, clear your cache, or disable browser extensions. Safari sometimes has issues with the security checks.
                </p>
              </details>

              <details className="gckey-faq-item">
                <summary>I forgot my GCKey username or password</summary>
                <p>
                  Go to the GCKey login page and click <strong>"Forgot Your Username?"</strong> or <strong>"Forgot Your Password?"</strong>.
                  You'll need to answer your recovery questions. If you can't recover your account, you may need to create a new GCKey —
                  but your previous IRCC application data will still be there once you link the new GCKey to IRCC.
                </p>
              </details>

              <details className="gckey-faq-item">
                <summary>GCKey account locked</summary>
                <p>
                  After multiple failed login attempts, your account may be locked for security. Wait 30 minutes and try again,
                  or contact Service Canada at <strong>1-800-O-Canada (1-800-622-6232)</strong> for assistance.
                </p>
              </details>

              <details className="gckey-faq-item">
                <summary>Can I use GCKey from outside Canada?</summary>
                <p>
                  <strong>Yes!</strong> GCKey works from anywhere in the world. You don't need to be in Canada or have a Canadian
                  phone number to create or use a GCKey account.
                </p>
              </details>
            </section>

            {/* What's Next */}
            <section id="whats-next" className="gckey-section">
              <h2>🚀 What's Next?</h2>
              <p>Now that you have your GCKey account, here's what to do next on your PR journey:</p>

              <div className="gckey-next-steps">
                <Link to="/get-started" className="gckey-next-card">
                  <div className="gckey-next-icon">✅</div>
                  <div className="gckey-next-content">
                    <strong>Check Your Eligibility</strong>
                    <p>Find out which Express Entry programs (FSWP, CEC, FSTP) you qualify for — in 2 minutes.</p>
                  </div>
                  <span className="gckey-next-arrow">→</span>
                </Link>

                <Link to="/crs-calculator" className="gckey-next-card">
                  <div className="gckey-next-icon">🧮</div>
                  <div className="gckey-next-content">
                    <strong>Calculate Your CRS Score</strong>
                    <p>Know your exact score and see how you compare to recent draw cutoffs.</p>
                  </div>
                  <span className="gckey-next-arrow">→</span>
                </Link>

                <Link to="/find-my-noc" className="gckey-next-card">
                  <div className="gckey-next-icon">🎯</div>
                  <div className="gckey-next-content">
                    <strong>Find Your NOC Code</strong>
                    <p>Match your job duties to the correct NOC 2021 code before filling out your profile.</p>
                  </div>
                  <span className="gckey-next-arrow">→</span>
                </Link>

                <Link to="/documents" className="gckey-next-card">
                  <div className="gckey-next-icon">📋</div>
                  <div className="gckey-next-content">
                    <strong>Avoid the 12 Common Mistakes</strong>
                    <p>Don't let a simple error cost you your PR application. Check the most common pitfalls.</p>
                  </div>
                  <span className="gckey-next-arrow">→</span>
                </Link>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
};
