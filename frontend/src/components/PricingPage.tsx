/**
 * Pricing Page — Tier comparison and checkout
 * 
 * Three tiers: Explore (Free), Optimize (Starter $49), Execute (Complete $99)
 * Optimized for conversion with CRO principles.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { useJourneyStore } from '../stores/journeyStore';
import { createCheckoutSession } from '../services/api';
import { CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import ReactGA from 'react-ga4';
import './PricingPage.css';

export function PricingPage() {
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const { tier } = useJourneyStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  useEffect(() => {
    ReactGA.event("view_item_list", {
      item_list_id: "pricing_tiers",
      item_list_name: "Pricing Tiers",
      items: [
        { item_id: "free", item_name: "Explore", price: 0 },
        { item_id: "starter", item_name: "Optimize", price: 49 },
        { item_id: "complete", item_name: "Execute", price: 99 }
      ]
    });
  }, []);

  const handleUpgrade = async (passType: 'starter' | 'complete') => {
    if (!isSignedIn) return;
    
    ReactGA.event("begin_checkout", {
      currency: "CAD",
      value: passType === 'complete' ? 99 : 49,
      items: [{
        item_id: passType,
        item_name: passType === 'complete' ? "Execute" : "Optimize",
        price: passType === 'complete' ? 99 : 49
      }]
    });

    setIsLoading(passType);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await createCheckoutSession(passType, token, '/pricing');
      if (result?.session_url) {
        window.location.href = result.session_url;
      }
    } catch (e) {
      console.error('Checkout failed:', e);
    } finally {
      setIsLoading(null);
    }
  };

  const isCurrentTier = (t: string) => tier === t;

  return (
    <div>
      <SEO
        title="Pricing — Mentor Visa Canada PR Platform"
        description="Choose the plan that fits your PR journey. Free tools, Optimize bundle, or Execute package with AI auditors."
      />

      <section className="page-hero" style={{ paddingBottom: '40px' }}>
        <div className="page-hero-content pricing-header">
          <div className="pricing-urgency-badge animate-reveal delay-1">
            🚀 The Next Express Entry Draw is Unpredictable. Will You Be Ready?
          </div>
          <h1 className="animate-reveal delay-2">Stop Guessing.<br /><span className="pricing-accent">Start Maximizing Your CRS Score.</span></h1>
          <p className="pricing-subtitle animate-reveal delay-3">
            Avoid costly application mistakes and expensive consultants. Get the exact tools you need to build a flawless PR profile and secure your ITA.
          </p>
        </div>
      </section>

      <div className="pricing-page">
        <div className="pricing-social-proof animate-reveal delay-3">
          <div className="pricing-social-proof-inner">
            <p>Trusted by <strong>2,500+ applicants</strong> to perfect their Express Entry profiles.</p>
          </div>
        </div>

      {/* Comparison callout moved ABOVE pricing */}
      <div className="pricing-comparison animate-reveal delay-4">
        <h3>Why pay thousands for a consultant when you can do it yourself?</h3>
        <div className="pricing-comparison-grid">
          <div className="comparison-card">
            <span className="comparison-price">$300–$800</span>
            <span className="comparison-label">Consultant (1 Hour Advice)</span>
          </div>
          <div className="comparison-card">
            <span className="comparison-price">$1,500–$5,000</span>
            <span className="comparison-label">Full-Service Consultant</span>
          </div>
          <div className="comparison-card highlight">
            <span className="comparison-price">Starting at $49</span>
            <span className="comparison-label">Mentor Visa Toolkit</span>
          </div>
        </div>
      </div>

      <div className="pricing-grid">
        {/* ── Explore (Free) Tier ── */}
        <div className={`pricing-card animate-reveal delay-5 ${isCurrentTier('free') ? 'current' : ''}`}>
          {isCurrentTier('free') && <div className="pricing-current-badge">Current Plan</div>}
          <div className="pricing-card-header">
            <h3>Explore</h3>
            <div className="pricing-price">$0</div>
            <p className="pricing-desc">Discover your true score and fix critical mistakes.</p>
          </div>
          <ul className="pricing-features">
            <Feature included>Unlimited CRS Calculator</Feature>
            <Feature included>Unlimited NOC Code Finder</Feature>
            <Feature included>Eligibility Check</Feature>
            <Feature included>12 Common Mistakes Guide</Feature>
            <Feature included>GCKey Setup Guide</Feature>
          </ul>
          <div className="pricing-card-footer">
            {!isSignedIn ? (
              <SignInButton mode="modal" fallbackRedirectUrl="/pricing">
                <button className="pricing-btn outline">Create Free Account</button>
              </SignInButton>
            ) : isCurrentTier('free') ? (
              <button className="pricing-btn current" disabled>Your Current Plan</button>
            ) : (
              <button className="pricing-btn outline" disabled>Included</button>
            )}
          </div>
        </div>

        {/* ── Optimize (Starter) Tier ── */}
        <div className={`pricing-card animate-reveal delay-6 ${isCurrentTier('starter') ? 'current' : ''}`}>
          {isCurrentTier('starter') && <div className="pricing-current-badge">Current Plan</div>}
          <div className="pricing-card-header">
            <h3>Optimize</h3>
            <div className="pricing-price">$49 <span>CAD</span></div>
            <p className="pricing-desc">Audit your employment letters and track expirations.</p>
          </div>
          <ul className="pricing-features">
            <Feature included>Everything in Explore</Feature>
            <Feature included highlight>Unlimited Employment Letter Audits</Feature>
            <Feature included highlight>Smart Post-ITA Milestone Tracker &amp; Predictor</Feature>
            <Feature included highlight>Unlimited CRS Point Simulator (What-If Scenarios)</Feature>
            <Feature included highlight>20 Question Credits - Express Entry AI Assistant</Feature>
            <Feature included highlight>Personalized Document Checklist</Feature>
            <Feature included highlight>Document Expiry Tracker</Feature>
          </ul>
          <div className="pricing-card-footer">
            {!isSignedIn ? (
              <SignInButton mode="modal" fallbackRedirectUrl="/pricing">
                <button className="pricing-btn secondary">Optimize My Profile</button>
              </SignInButton>
            ) : isCurrentTier('starter') ? (
              <button className="pricing-btn current" disabled>Your Current Plan</button>
            ) : isCurrentTier('complete') ? (
              <button className="pricing-btn current" disabled>Included in Execute</button>
            ) : (
              <button 
                className="pricing-btn secondary" 
                onClick={() => handleUpgrade('starter')}
                disabled={isLoading === 'starter'}
              >
                {isLoading === 'starter' ? 'Redirecting...' : 'Get Optimize — $49 CAD'}
              </button>
            )}
          </div>
        </div>

        {/* ── Execute (Complete) Tier ── */}
        <div className={`pricing-card featured animate-reveal delay-7 ${isCurrentTier('complete') ? 'current' : ''}`}>
          <div className="pricing-popular-badge">⭐ BEST VALUE</div>
          {isCurrentTier('complete') && <div className="pricing-current-badge" style={{ top: '32px' }}>Current Plan</div>}
          <div className="pricing-card-header">
            <h3>Execute</h3>
            <div className="pricing-price">$99 <span>CAD</span></div>
            <p className="pricing-desc">Your complete AI toolkit for absolute peace of mind.</p>
          </div>
          <ul className="pricing-features">
            <Feature included>Everything in Optimize</Feature>
            <Feature included highlight>Unlimited Express Entry AI Assistant</Feature>
            <Feature included highlight>Priority Early Access to Features</Feature>
          </ul>
          <div className="pricing-card-footer">
            {!isSignedIn ? (
              <SignInButton mode="modal" fallbackRedirectUrl="/pricing">
                <button className="pricing-btn primary">Get Execute Access</button>
              </SignInButton>
            ) : isCurrentTier('complete') ? (
              <button className="pricing-btn current" disabled>Your Current Plan</button>
            ) : (
              <button 
                className="pricing-btn primary" 
                onClick={() => handleUpgrade('complete')}
                disabled={isLoading === 'complete'}
              >
                {isLoading === 'complete' ? 'Redirecting...' : 'Get Execute Access — $99 CAD'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Money-back guarantee directly under pricing */}
      <div className="pricing-guarantee animate-reveal delay-8">
        <h3>🛡️ 3-Day "No Questions Asked" Guarantee</h3>
        <p>
          If you don't feel significantly more confident about your PR application after using our tools, simply email us within 3 days for a full refund. You have literally nothing to lose.
        </p>
      </div>

      {/* FAQ */}
      <div className="pricing-faq animate-reveal delay-9">
        <h3>Common Questions</h3>
        <details className="pricing-faq-item">
          <summary>Is this a subscription?</summary>
          <p>No — all plans are one-time payments. You get lifetime access to the features included in your plan.</p>
        </details>
        <details className="pricing-faq-item">
          <summary>Can I upgrade from Optimize to Execute later?</summary>
          <p>Yes! If you start with the $49 Optimize plan and later want the full toolkit, you can upgrade to Execute and only pay the difference ($50 CAD).</p>
        </details>
        <details className="pricing-faq-item">
          <summary>What does "Unlimited" mean?</summary>
          <p>Paid tier users get unlimited access to the tools included in their plan — no artificial limits. Use the Letter Auditor as many times as you need until your letter is perfect.</p>
        </details>
      </div>

      {/* CTA */}
      <div className="pricing-cta animate-reveal delay-10">
        <h2>Start Your PR Journey Today</h2>
        <p>The eligibility check is free. See which programs you qualify for in 2 minutes.</p>
        <button className="pricing-btn primary" onClick={() => navigate('/get-started')}>
          Check My Eligibility — Free →
        </button>
      </div>
    </div>
    </div>
  );
}


// ── Feature line component ──

function Feature({ 
  children, 
  included = false, 
  highlight = false 
}: { 
  children: React.ReactNode; 
  included?: boolean;
  highlight?: boolean;
}) {
  return (
    <li className={`pricing-feature ${highlight ? 'highlight' : ''}`}>
      {included ? (
        <CheckCircle2 size={16} className="feature-check" />
      ) : (
        <X size={16} className="feature-x" />
      )}
      <span className={!included ? 'feature-disabled' : ''}>{children}</span>
    </li>
  );
}
