import { type FC } from 'react';
import { SEO } from './common/SEO';

export const RefundPolicyPage: FC = () => (
  <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
    <SEO title="Refund Policy | Mentor Visa" description="Read Mentor Visa's refund policy for digital pass purchases." canonical="/refund-policy" />
    
    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--primary-dark)' }}>Refund Policy</h1>
    <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.9rem' }}>Last updated: April 8, 2026</p>

    <div style={{ lineHeight: 1.8, fontSize: '0.95rem', color: '#374151' }}>
      <p>Thank you for using Mentor Visa. We strive to provide high-quality AI-powered analysis tools for your Canadian immigration documents.</p>
      <p>Please read this policy carefully before purchasing any credits or passes on our platform.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>1. 3-Day Money-Back Guarantee</h2>
      <p>We stand behind the quality of Mentor Visa's tools. If you purchase a subscription or an individual pass and are not satisfied with the value provided, you are eligible for a full refund within <strong>3 days (72 hours)</strong> of your original purchase.</p>
      
      <p>To request a refund under this guarantee, simply email us within the 3-day window. Upon processing the refund, your premium access and credits will be revoked.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>2. After the 3-Day Guarantee Period</h2>
      <p>Once the 3-day guarantee period has passed, all sales are considered <strong>final and non-refundable</strong>. We do not offer prorated refunds for partially used subscription periods or unused individual passes.</p>
      <p>We may, at our sole discretion, grant a refund after this period only under exceptional circumstances, such as:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li><strong>Duplicate Billing:</strong> You were charged multiple times for the same transaction due to a payment processing error.</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>3. Requesting an Exception</h2>
      <p>If you believe your situation qualifies for an exception under Section 2, you must contact us within <strong>48 hours</strong> of the original transaction.</p>
      <p>To submit a request, please email us with the following information:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
        <li>The email address associated with your Mentor Visa account.</li>
        <li>A clear description of the issue (e.g., duplicate charge).</li>
        <li>Any relevant screenshots or error messages.</li>
      </ul>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>4. Chargebacks</h2>
      <p>If you initiate a chargeback or dispute with your credit card issuer or bank for a valid charge, your Mentor Visa account may be immediately suspended or terminated, and you may be blocked from making future purchases on our platform.</p>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '32px 0 12px', color: 'var(--primary-dark)' }}>5. Contact Us</h2>
      <p>If you have any questions about this Refund Policy before making a purchase, please contact us at:</p>
      <p style={{ marginTop: '8px' }}>
        <strong>Mentor Visa</strong><br />
        Email: <a href="mailto:info@mentorvisa.com" style={{ color: 'var(--primary-color)' }}>info@mentorvisa.com</a>
      </p>
    </div>
  </div>
);
