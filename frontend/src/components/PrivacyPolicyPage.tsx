import { type FC } from 'react';
import { SEO } from './common/SEO';

export const PrivacyPolicyPage: FC = () => (
  <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
    <SEO title="Privacy Policy | Mentor Visa" description="Learn how Mentor Visa collects, uses, and protects your personal information." canonical="/privacy-policy" />
    
    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--primary-dark)' }}>Privacy Policy</h1>
    <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.9rem' }}>Last updated: April 8, 2026</p>

    <div style={{ lineHeight: 1.8, fontSize: '0.95rem', color: '#374151' }}>
      <p>Mentor Visa ("we", "us", or "our") operates the <strong>mentorvisa.com</strong> website ("Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services. We are committed to protecting your privacy in compliance with Canada's <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong>.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>1. Information We Collect</h2>
      
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '20px 0 8px' }}>1.1 Information You Provide Directly</h3>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Account Information:</strong> When you sign up, we collect your name and email address through our authentication provider (Clerk).</li>
        <li><strong>Uploaded Documents:</strong> Employment letters, job descriptions, and other documents you upload for analysis. These are stored securely on our infrastructure.</li>
        <li><strong>Manual Input:</strong> Job titles, duty descriptions, and other text you enter into our tools.</li>
        <li><strong>Payment Information:</strong> When you purchase a pass, payment is processed by Stripe. We do <strong>not</strong> store your credit card number, CVV, or full card details. Stripe handles all payment data under PCI-DSS Level 1 compliance.</li>
      </ul>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '20px 0 8px' }}>1.2 Information Collected Automatically</h3>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Usage Analytics:</strong> We use Vercel Web Analytics and Google Analytics 4 to collect anonymized usage data such as page views, session duration, and general geographic region.</li>
        <li><strong>Device Data:</strong> Browser type, operating system, and screen resolution for optimizing user experience.</li>
        <li><strong>Cookies:</strong> Essential cookies for authentication session management. We do not use advertising or tracking cookies.</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>2. How We Use Your Information</h2>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li>To provide and operate our document analysis and NOC code matching services.</li>
        <li>To process your payments and manage your account credits.</li>
        <li>To save and display your past evaluation history.</li>
        <li>To improve our AI analysis accuracy and service quality.</li>
        <li>To communicate with you regarding your account or service updates.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>3. Data Storage and Security</h2>
      <p>Your data is stored on secure, encrypted cloud infrastructure hosted in North America:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Database:</strong> Supabase (PostgreSQL) with Row Level Security (RLS) enabled.</li>
        <li><strong>File Storage:</strong> Uploaded documents are stored in Supabase Storage with access controls.</li>
        <li><strong>Authentication:</strong> Managed by Clerk with industry-standard encryption.</li>
        <li><strong>Payments:</strong> Processed by Stripe under PCI-DSS Level 1 compliance.</li>
      </ul>
      <p>We implement reasonable administrative, technical, and physical safeguards to protect your personal information. However, no method of electronic transmission or storage is 100% secure.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>4. Data Sharing and Third Parties</h2>
      <p>We do <strong>not</strong> sell, rent, or trade your personal information. We share data only with the following third-party service providers, solely to operate our Service:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Clerk</strong> — Authentication and user management</li>
        <li><strong>Stripe</strong> — Payment processing</li>
        <li><strong>Supabase</strong> — Database and file storage</li>
        <li><strong>Google (Gemini AI)</strong> — Document analysis processing. Uploaded document contents are sent to Google's Gemini API for analysis. Google's data usage policies apply to this processing.</li>
        <li><strong>Vercel</strong> — Website hosting and analytics</li>
        <li><strong>Google Analytics</strong> — Anonymized usage analytics</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>5. Data Retention</h2>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li>Account data is retained for as long as your account is active.</li>
        <li>Evaluation records are retained indefinitely for your reference unless you request deletion.</li>
        <li>Uploaded documents are retained for service functionality and may be deleted upon request.</li>
        <li>Payment records are retained as required by applicable tax and financial regulations.</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>6. Your Rights Under PIPEDA</h2>
      <p>As a Canadian resident, you have the right to:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Access</strong> your personal information held by us.</li>
        <li><strong>Correct</strong> any inaccurate personal information.</li>
        <li><strong>Request deletion</strong> of your personal information.</li>
        <li><strong>Withdraw consent</strong> to the collection, use, or disclosure of your personal information.</li>
      </ul>
      <p>To exercise any of these rights, please contact us at <a href="mailto:info@mentorvisa.com" style={{ color: 'var(--primary-color)' }}>info@mentorvisa.com</a>.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>7. Children's Privacy</h2>
      <p>Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>9. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us:</p>
      <p style={{ marginTop: '8px' }}>
        <strong>Mentor Visa</strong><br />
        Ontario, Canada<br />
        Email: <a href="mailto:info@mentorvisa.com" style={{ color: 'var(--primary-color)' }}>info@mentorvisa.com</a>
      </p>
    </div>
  </div>
);
