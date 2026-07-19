/**
 * PaywallGate — Reusable paywall wrapper component
 * 
 * Usage:
 *   <PaywallGate requiredTier="starter" featureName="Document Tracker">
 *     <ProtectedContent />
 *   </PaywallGate>
 * 
 * If user's tier >= required: renders children normally.
 * If not: renders a blurred preview with an upgrade CTA.
 */

import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneyStore } from '../../stores/journeyStore';
import './PaywallGate.css';

interface PaywallGateProps {
  requiredTier: 'starter' | 'complete';
  featureName: string;
  children: ReactNode;
  previewLines?: number; // How many lines of content to show in preview
  blurAmount?: number;
  features?: string[]; // Optional override for the feature bullets shown in the CTA
  onUpgrade?: () => void; // If provided, the CTA calls this (e.g. direct Stripe checkout) instead of routing to /pricing
}

const TIER_ORDER = { free: 0, starter: 1, complete: 2 };

const TIER_PRICES: Record<string, string> = {
  starter: '$49 CAD',
  complete: '$99 CAD',
};

const TIER_FEATURES: Record<string, string[]> = {
  starter: [
    'Unlimited NOC Code Finder',
    'Unlimited Employment Letter Audits',
    'Smart Post-ITA Milestone Tracker & Predictor',
    'Unlimited CRS Point Simulator (What-If Scenarios)',
    '20 Question Credits — Express Entry AI Assistant',
    'Personalized Document Checklist & Expiry Tracker',
    '1 Free GCMS Notes Order ($19.90 value)',
  ],
  complete: [
    'Everything in Optimize',
    'Express Entry AI Assistant',
    'Unlimited Employment Letter Audits',
    'Unlimited AI Assistant Access',
  ],
};

export function PaywallGate({
  requiredTier,
  featureName,
  children,
  blurAmount = 5,
  features,
  onUpgrade,
}: PaywallGateProps) {
  const { tier } = useJourneyStore();
  const navigate = useNavigate();

  const hasAccess = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
  const featureList = features ?? TIER_FEATURES[requiredTier] ?? [];
  const tierLabel = requiredTier === 'starter' ? 'Optimize' : 'Execute';
  const handleUpgrade = onUpgrade ?? (() => navigate(`/pricing?upgrade=${requiredTier}`));

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="paywall-gate">
      <div
        className="paywall-preview"
        style={{ filter: `blur(${blurAmount}px)` }}
      >
        {children}
      </div>

      <div className="paywall-overlay">
        <div className="upgrade-card">
          <div className="upgrade-card-icon">🔓</div>
          <h3 className="upgrade-card-title">Unlock {featureName}</h3>
          <div className="upgrade-card-price">{TIER_PRICES[requiredTier].replace(' CAD', '')} <span>CAD</span></div>
          <p className="upgrade-card-subtitle">
            Included in <strong>{tierLabel}</strong> — unlock this plus every premium tool.
          </p>

          <ul className="upgrade-card-features">
            {featureList.map((feature, i) => (
              <li key={i}>
                <span className="upgrade-card-check">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <button className="upgrade-card-btn-primary" onClick={handleUpgrade}>
            Get {tierLabel} — {TIER_PRICES[requiredTier]}
          </button>

          <p className="upgrade-card-guarantee">
            💚 3-Day Money-Back Guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
