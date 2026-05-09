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
}

const TIER_ORDER = { free: 0, starter: 1, complete: 2 };

const TIER_PRICES: Record<string, string> = {
  starter: '$49 CAD',
  complete: '$99 CAD',
};

const TIER_FEATURES: Record<string, string[]> = {
  starter: [
    'Unlimited Employment Letter Audits',
    'Personalized Document Tracker',
    'CRS Point Maximization Simulator',
    'Category-Based Draw Matcher',
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
}: PaywallGateProps) {
  const { tier } = useJourneyStore();
  const navigate = useNavigate();

  const hasAccess = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];

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
          <div className="upgrade-card-icon">🔒</div>
          <h3 className="upgrade-card-title">
            Unlock {featureName}
          </h3>
          <p className="upgrade-card-subtitle">
            Upgrade to {requiredTier === 'starter' ? 'Optimize' : 'Execute'} to access this feature.
          </p>

          <ul className="upgrade-card-features">
            {TIER_FEATURES[requiredTier]?.map((feature, i) => (
              <li key={i}>
                <span className="upgrade-card-check">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <button
            className="upgrade-card-btn-primary"
            onClick={() => navigate(`/pricing?upgrade=${requiredTier}`)}
          >
            Upgrade to {requiredTier === 'starter' ? 'Optimize' : 'Execute'} — {TIER_PRICES[requiredTier]}
          </button>

          <p className="upgrade-card-guarantee">
            💚 3-Day Money-Back Guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
