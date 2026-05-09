/**
 * Documents Page — Error Prevention Engine
 * 
 * Two sections:
 * 1. The 12 Mistakes That Get PR Applications Refused (free content)
 * 2. Personalized Document Tracker (paid — Optimize tier)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { useJourneyStore } from '../stores/journeyStore';
import { generateDocumentChecklist, updateDocument as updateDocumentApi } from '../services/journeyApi';
import { createCheckoutSession } from '../services/api';
import { THE_12_MISTAKES, DOCUMENT_REQUIREMENTS, type MistakeDefinition } from '../data/documentRequirements';
import { CheckCircle2, X } from 'lucide-react';
import './Documents.css';
import './PricingPage.css';

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
      <span>{children}</span>
    </li>
  );
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { eligibility, profile, tier, documents, setDocuments, updateDocument } = useJourneyStore();
  const [expandedMistake, setExpandedMistake] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'mistakes' | 'tracker'>('mistakes');
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Scroll to top on mount ──
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Determine which programs user is eligible for
  const programs = useMemo(() => {
    const p: string[] = [];
    if (eligibility.fswpEligible) p.push('fswp');
    if (eligibility.cecEligible) p.push('cec');
    if (eligibility.fstpEligible) p.push('fstp');
    if (p.length === 0) p.push('fswp', 'cec'); // Default to showing FSWP + CEC
    return p;
  }, [eligibility]);

  // Filter documents based on user's profile
  const personalizedDocs = useMemo(() => {
    return DOCUMENT_REQUIREMENTS.filter(doc => {
      // Check if required for user's programs
      const requiredForUser = doc.requiredFor.includes('all') ||
        doc.requiredFor.some(prog => programs.includes(prog));
      if (!requiredForUser) return false;

      // Filter spouse-related docs
      if (doc.type.startsWith('spouse_') || doc.type === 'marriage_certificate') {
        if (profile.maritalStatus !== 'married' && profile.maritalStatus !== 'common_law') return false;
        if (!profile.spouseAccompanying) return false;
      }

      return true;
    });
  }, [programs, profile]);

  // Calculate progress
  const obtainedCount = documents.filter(d => d.status === 'obtained').length;
  const totalDocs = Math.max(personalizedDocs.length, documents.length);
  const progressPct = totalDocs > 0 ? (obtainedCount / totalDocs) * 100 : 0;

  // ── Auto-generate backend checklist on first visit for paid users ──
  useEffect(() => {
    if (activeTab !== 'tracker' || tier === 'free' || documents.length > 0 || isGenerating) return;

    const generate = async () => {
      setIsGenerating(true);
      try {
        const token = await getToken();
        if (!token) return;
        const result = await generateDocumentChecklist(token);
        if (result.documents) {
          setDocuments(result.documents);
        }
      } catch (e) {
        console.error('Failed to generate document checklist:', e);
      } finally {
        setIsGenerating(false);
      }
    };
    generate();
  }, [activeTab, tier, documents.length, isGenerating, getToken, setDocuments]);

  // ── Status toggle handler ──
  const handleStatusToggle = useCallback(async (docType: string) => {
    const existing = documents.find(d => d.document_type === docType);
    if (!existing?.id) return; // Backend doc must exist

    const nextStatus: Record<string, 'not_started' | 'in_progress' | 'obtained'> = {
      'not_started': 'in_progress',
      'in_progress': 'obtained',
      'obtained': 'not_started',
    };
    const newStatus = nextStatus[existing.status] || 'not_started';

    // Optimistic local update
    updateDocument(docType, { status: newStatus });

    // Persist to backend
    try {
      const token = await getToken();
      if (token && existing.id) {
        await updateDocumentApi(token, existing.id, {
          status: newStatus,
          // Clear expiry when cycling back to not_started
          ...(newStatus === 'not_started' ? { expiry_date: null } : {}),
        });
      }
    } catch (e) {
      console.error('Failed to update document status:', e);
      // Revert on failure
      updateDocument(docType, { status: existing.status });
    }
  }, [documents, updateDocument, getToken]);

  // ── Expiry date handler ──
  const handleExpiryDate = useCallback(async (docType: string, obtainedDate: string, validityDays: number) => {
    const existing = documents.find(d => d.document_type === docType);
    if (!existing?.id) return;

    const obtained = new Date(obtainedDate);
    const expiry = new Date(obtained.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const expiryIso = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

    // Optimistic local update
    updateDocument(docType, { expiry_date: expiryIso });

    // Persist to backend
    try {
      const token = await getToken();
      if (token && existing.id) {
        await updateDocumentApi(token, existing.id, { expiry_date: expiryIso });
      }
    } catch (e) {
      console.error('Failed to update expiry date:', e);
    }
  }, [documents, updateDocument, getToken]);

  return (
    <div className="documents-page">
      <SEO
        title="12 Mistakes That Get PR Applications Refused | Mentor Visa"
        description="Don't let a preventable mistake cost you your Canada PR. Learn the 12 most common errors and how to avoid them."
      />

      {/* Journey context bar */}

      <div className="documents-header">
        <h1>
          <span className="documents-header-accent">The 12 Mistakes</span> That Get Canada PR Applications Refused
        </h1>
        <p className="documents-header-sub">
          We catch them before IRCC does. Each mistake below has cost real applicants months of delays and thousands of dollars.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="documents-tabs">
        <button
          className={`documents-tab ${activeTab === 'mistakes' ? 'active' : ''}`}
          onClick={() => setActiveTab('mistakes')}
        >
          ⚠️ 12 Mistakes Guide
        </button>
        <button
          className={`documents-tab ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          📋 Document Tracker
          {tier !== 'free' && documents.length > 0 && (
            <span className="documents-tab-badge">{obtainedCount}/{totalDocs}</span>
          )}
        </button>
      </div>

      {/* ── 12 Mistakes Section ── */}
      {activeTab === 'mistakes' && (
        <div className="mistakes-grid">
          {THE_12_MISTAKES.map(mistake => (
            <MistakeCard
              key={mistake.id}
              mistake={mistake}
              isExpanded={expandedMistake === mistake.id}
              onToggle={() => setExpandedMistake(expandedMistake === mistake.id ? null : mistake.id)}
              onNavigate={navigate}
            />
          ))}
        </div>
      )}

      {/* ── Document Tracker Section ── */}
      {activeTab === 'tracker' && (
        <div className="tracker-section">
          {tier === 'free' ? (
            <div className="tracker-paywall">
              <div className="tracker-paywall-preview">
                <h3>📋 Your Personalized Document Checklist</h3>
                {!eligibility.completedAt ? (
                  <p>
                    Complete the <button className="inline-link" onClick={() => navigate('/get-started')}>Eligibility Assessment</button> first to generate your personalized checklist.
                  </p>
                ) : (
                  <>
                    <p>We found <strong>{personalizedDocs.length} documents</strong> you'll need for your {eligibility.recommendedProgram || 'Express Entry'} application.</p>
                    <div className="tracker-preview-list">
                      {personalizedDocs.slice(0, 3).map(doc => (
                        <div key={doc.type} className="tracker-preview-item">
                          <span className="tracker-preview-icon">📄</span>
                          <span>{doc.label}</span>
                        </div>
                      ))}
                      {personalizedDocs.length > 3 && (
                        <div className="tracker-preview-more">
                          + {personalizedDocs.length - 3} more documents...
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="tracker-paywall-cta">
                  <div className="tracker-paywall-blur" />
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', width: '100%', marginTop: '2rem' }}>
                    <div className="pricing-card featured animate-reveal delay-1" style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <div className="pricing-popular-badge">⭐ BEST VALUE</div>
                      <div className="pricing-card-header">
                        <h3>Optimize</h3>
                        <div className="pricing-price">$49 <span>CAD</span></div>
                        <p className="pricing-desc">Everything you need to perfect your profile.</p>
                      </div>
                      <ul className="pricing-features">
                        <Feature included>20 Question Credits - Express Entry AI Assistant</Feature>
                        <Feature included>Unlimited Employment Letter Audits</Feature>
                        <Feature included>Unlimited CRS Point Simulator (What-If Scenarios)</Feature>
                        <Feature included>Personalized Document Checklist</Feature>
                        <Feature included>Document Expiry Tracking</Feature>
                      </ul>
                      <div className="pricing-card-footer">
                        <button className="pricing-btn primary" style={{ width: '100%' }} onClick={async () => {
                          try {
                            const token = await getToken();
                            if (token) {
                              const result = await createCheckoutSession('starter', token, '/documents');
                              if (result?.session_url) window.location.href = result.session_url;
                            } else {
                              navigate('/pricing');
                            }
                          } catch (e) {
                            console.error('Checkout error:', e);
                            navigate('/pricing');
                          }
                        }}>
                          Get Optimize — $49 CAD
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="tracker-generating">
              <div className="tracker-generating-spinner" />
              <p>Generating your personalized document checklist...</p>
            </div>
          ) : (
            <div className="tracker-active">
              {/* Progress bar */}
              <div className="tracker-progress">
                <div className="tracker-progress-header">
                  <span>{obtainedCount} of {totalDocs} documents ready</span>
                  <span className="tracker-progress-pct">{Math.round(progressPct)}%</span>
                </div>
                <div className="tracker-progress-bar">
                  <div className="tracker-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Document list */}
              <div className="tracker-list">
                {personalizedDocs.map(doc => {
                  const existing = documents.find(d => d.document_type === doc.type);
                  const status = existing?.status || 'not_started';
                  const expiryDate = existing?.expiry_date;

                  return (
                    <div key={doc.type} className={`tracker-item status-${status}`}>
                      <div className="tracker-item-left">
                        <button
                          className={`tracker-status-toggle ${status}`}
                          title="Click to change status"
                          onClick={() => handleStatusToggle(doc.type)}
                        >
                          {status === 'obtained' ? '✅' : status === 'in_progress' ? '🔄' : '⬜'}
                        </button>
                        <div className="tracker-item-info">
                          <span className="tracker-item-label">{doc.label}</span>
                          <span className="tracker-item-time">{doc.processingTime}</span>
                          {doc.mistakeId && (
                            <span className="tracker-item-warning">
                              ⚠️ Related to Mistake #{doc.mistakeId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="tracker-item-right">
                        {doc.validityDays && expiryDate && (
                          <ExpiryBadge expiryDate={expiryDate} />
                        )}
                        {/* Expiry date input — appears when document is obtained and has a validity period */}
                        {status === 'obtained' && doc.validityDays && (
                          <DateObtainedInput
                            docType={doc.type}
                            validityDays={doc.validityDays}
                            currentExpiry={expiryDate || null}
                            onSave={handleExpiryDate}
                          />
                        )}
                        {doc.externalUrl && (
                          <a href={doc.externalUrl} target="_blank" rel="noopener noreferrer" className="tracker-external-link">
                            Source ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="documents-disclaimer">
        This tool is for informational purposes only and does not constitute legal or immigration advice.
        Mentor Visa is not a Regulated Canadian Immigration Consultant (RCIC) or law firm.
        Always verify information against the official IRCC website (canada.ca).
      </div>
    </div>
  );
}


// ── Mistake Card Component ──

function MistakeCard({
  mistake,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  mistake: MistakeDefinition;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}) {
  const severityColors = {
    critical: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', badge: '#ef4444' },
    high: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', badge: '#f59e0b' },
    medium: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', badge: '#3b82f6' },
  };
  const colors = severityColors[mistake.severity];

  return (
    <div
      className={`mistake-card ${isExpanded ? 'expanded' : ''}`}
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <button className="mistake-card-header" onClick={onToggle}>
        <div className="mistake-card-number" style={{ color: colors.badge }}>#{mistake.id}</div>
        <div className="mistake-card-content">
          <h3 className="mistake-card-title">{mistake.title}</h3>
          <p className="mistake-card-consequence">
            <span className="consequence-label">Consequence:</span> {mistake.consequence}
          </p>
        </div>
        <div className="mistake-card-severity">
          <span className="severity-badge" style={{ background: colors.badge }}>
            {mistake.severity}
          </span>
        </div>
        <span className={`mistake-card-chevron ${isExpanded ? 'rotated' : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="mistake-card-details">
          <p className="mistake-card-explanation">{mistake.detailedExplanation}</p>
          <div className="mistake-card-prevention">
            <strong>How we prevent this:</strong> {mistake.howWePreventIt}
          </div>
          {mistake.actionButton && (
            <button
              className="mistake-action-btn"
              onClick={() => onNavigate(mistake.actionButton!.route)}
            >
              {mistake.actionButton.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ── Date Obtained Input Component ──
// Uses controlled state with explicit save to prevent calendar arrow-key from
// accidentally committing a date on each tick.

function DateObtainedInput({
  docType,
  validityDays,
  currentExpiry,
  onSave,
}: {
  docType: string;
  validityDays: number;
  currentExpiry: string | null;
  onSave: (docType: string, obtainedDate: string, validityDays: number) => void;
}) {
  // Back-compute the obtained date from the stored expiry date
  const computeObtained = (): string => {
    if (!currentExpiry) return '';
    const expiry = new Date(currentExpiry);
    const obtained = new Date(expiry.getTime() - validityDays * 24 * 60 * 60 * 1000);
    return obtained.toISOString().split('T')[0];
  };

  const [value, setValue] = useState(computeObtained);
  const [isDirty, setIsDirty] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const commitDate = () => {
    if (value && isDirty) {
      onSave(docType, value, validityDays);
      setIsDirty(false);
    }
  };

  return (
    <div className="tracker-expiry-input">
      <label>{currentExpiry ? 'Date obtained:' : 'When obtained?'}</label>
      <div className="tracker-expiry-row">
        <input
          type="date"
          max={today}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setIsDirty(true);
          }}
          onBlur={commitDate}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDate();
            }
          }}
        />
        {isDirty && value && (
          <button
            className="tracker-expiry-save"
            onClick={commitDate}
            title="Save date"
          >
            ✓
          </button>
        )}
      </div>
    </div>
  );
}

function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return <span className="expiry-badge expired">Expired</span>;
  }
  if (daysLeft <= 30) {
    return <span className="expiry-badge urgent">⚠️ {daysLeft}d left</span>;
  }
  if (daysLeft <= 90) {
    return <span className="expiry-badge warning">{daysLeft}d left</span>;
  }
  return <span className="expiry-badge ok">{daysLeft}d left</span>;
}
