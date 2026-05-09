/**
 * CRS War Room — Score Gap Analysis, Point Simulator, and Category Matcher
 * 
 * Three sections added below the existing CRS Calculator:
 * 1. Score Gap Chart (free) — user's score vs. recent draw cutoffs
 * 2. Point Maximization Simulator (Optimize tier) — what-if scenarios
 * 3. Category-Based Draw Matcher (Optimize tier) — targeted draw eligibility
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import { ALL_DRAWS, DRAW_TYPE_COLORS } from '../data/drawResults';
import { getCategoriesForNoc, CATEGORY_INFO } from '../data/nocCategoryMap';
import { getImprovementScenarios, getInvitationAnalysis, checkDrawEligibility, type ImprovementScenario, type SimulatorProfile } from '../utils/crsSimulator';
import { useJourneyStore } from '../stores/journeyStore';
import { useAuth } from '@clerk/clerk-react';
import { createCheckoutSession } from '../services/api';
import { CheckCircle2, X } from 'lucide-react';
import './CRSWarRoom.css';
import './PricingPage.css'; // Reuse pricing card styles

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

interface CRSWarRoomProps {
  userScore: number;
  tier: 'free' | 'starter' | 'complete';
  hasWarRoomAccess?: boolean;
  crsInputs?: any | null;
  unlockCTA?: React.ReactNode;
}

export function CRSWarRoom({ userScore, tier: _tier, hasWarRoomAccess = false, crsInputs: propsCrsInputs, unlockCTA }: CRSWarRoomProps) {
  const { noc, profile } = useJourneyStore();
  const [selectedDrawType, setSelectedDrawType] = useState('General');
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const navigate = useNavigate();
  const { getToken } = useAuth();

  // ── 1. Build Simulator Profile (must be before chartData which depends on it) ──
  const simulatorProfile = useMemo<SimulatorProfile>(() => {
    const clbMin = Math.min(
      profile.primaryLanguage?.speaking ?? 0,
      profile.primaryLanguage?.listening ?? 0,
      profile.primaryLanguage?.reading ?? 0,
      profile.primaryLanguage?.writing ?? 0
    );
    const secondClbMin = profile.secondaryLanguage ? Math.min(
      profile.secondaryLanguage.speaking ?? 0,
      profile.secondaryLanguage.listening ?? 0,
      profile.secondaryLanguage.reading ?? 0,
      profile.secondaryLanguage.writing ?? 0
    ) : 0;
    
    // Determine French Skills — check test type (tef/tcf), not .name
    const FRENCH_TESTS = ['tef', 'tcf'];
    let hasFrenchSkills = false;
    if (FRENCH_TESTS.includes(profile.primaryLanguage?.test || '') && clbMin >= 7) hasFrenchSkills = true;
    if (FRENCH_TESTS.includes(profile.secondaryLanguage?.test || '') && secondClbMin >= 7) hasFrenchSkills = true;

    // Use CRS calculator inputs as primary source when available (more accurate
    // than profile store which may not be synced yet)
    const canadianYears = propsCrsInputs?.canadianWorkYears ?? profile.canadianExperienceYears ?? 0;
    const foreignYears = propsCrsInputs
      ? propsCrsInputs.foreignWorkYears
      : (profile.totalSkilledExperienceYears ?? 0) - (profile.canadianExperienceYears ?? 0);

    return {
      crsScore: userScore,
      age: profile.age,
      hasSpouse: profile.maritalStatus === 'married' || profile.maritalStatus === 'common_law',
      spouseAccompanying: profile.spouseAccompanying ?? false,
      minClb: clbMin,
      hasSecondLanguage: profile.secondaryLanguage !== null,
      secondLanguageMinClb: secondClbMin,
      educationLevel: profile.educationLevel,
      canadianExperienceYears: canadianYears,
      foreignExperienceYears: foreignYears,
      hasProvincialNomination: profile.hasProvincialNomination ?? false,
      hasCanadianEducation: profile.educationInCanada ?? false,
      hasFrenchSkills,
      hasSiblingInCanada: profile.hasRelativeInCanada ?? false,
      spouseClbMin: profile.spouseLanguage ? Math.min(
        profile.spouseLanguage.speaking || 0,
        profile.spouseLanguage.listening || 0,
        profile.spouseLanguage.reading || 0,
        profile.spouseLanguage.writing || 0
      ) : 0,
      spouseEducation: profile.spouseEducationLevel,
      spouseCanadianYears: profile.spouseCanadianExperienceYears ?? 0,
    };
  }, [userScore, profile, propsCrsInputs]);

  // ── 2. Filter draws based on eligibility ──
  const relevantDraws = useMemo(() => {
    let draws = ALL_DRAWS;

    if (selectedDrawType === 'all') {
      // "All Draws" excludes draws the user is definitively ineligible for
      // or where eligibility can't be determined (unknown — e.g. no NOC code)
      draws = draws.filter(d => {
        const elig = checkDrawEligibility(d.drawType, simulatorProfile, noc.code);
        return elig.status === 'eligible';
      });
    } else {
      draws = draws.filter(d => d.drawType === selectedDrawType);
    }
    
    return draws;
  }, [selectedDrawType, simulatorProfile, noc.code]);

  // ── 3. Draw history data for chart ──
  const chartData = useMemo(() => {
    return relevantDraws
      .slice(0, 20)
      .reverse()
      .map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cutoff: d.crsScore,
        userScore: userScore,
        invitations: d.itasIssued,
        drawType: d.drawType,
      }));
  }, [relevantDraws, userScore]);

  // ── 4. Invitation analysis ──
  const invitationStats = useMemo(() => {
    // relevantDraws is already filtered by selectedDrawType and eligibility
    return getInvitationAnalysis(userScore, relevantDraws as any[], 'all', 12);
  }, [userScore, relevantDraws]);

  // ── 4. Category matches ──
  const categoryMatches = useMemo(() => {
    if (!noc.code) return [];
    const categories = getCategoriesForNoc(noc.code);
    return categories.map(cat => ({
      info: CATEGORY_INFO[cat],
      scoreDiff: userScore - CATEGORY_INFO[cat].avgCutoff2025,
    }));
  }, [noc.code, userScore]);

  // ── 4. Improvement scenarios ──
  const storeCrsInputs = useJourneyStore(state => state.crs.inputs);
  const crsInputs = propsCrsInputs || storeCrsInputs;
  const scenarios = useMemo(() => {
    return getImprovementScenarios(simulatorProfile, crsInputs);
  }, [simulatorProfile, crsInputs]);

  // Draw type options for filter
  const drawTypes = useMemo(() => {
    const types = new Set(ALL_DRAWS.map(d => d.drawType));
    return ['all', ...Array.from(types)];
  }, []);


  return (
    <div className="war-room">
      {/* ══════ Section 1: Score Gap Analysis (Free) ══════ */}
      <div className="war-room-section">
        <h3 className="war-room-title">
          📊 Score Gap Analysis
          <span className="war-room-badge free">Free</span>
        </h3>

        {/* Draw Type Filter */}
        <div className="war-room-filters">
          {drawTypes.slice(0, 6).map(type => {
            const eligibility = checkDrawEligibility(type, simulatorProfile, noc.code);
            const isIneligible = eligibility.status === 'ineligible';
            const isUnknown = eligibility.status === 'unknown';
            const isSelected = selectedDrawType === type;
            
            return (
              <button
                key={type}
                className={`war-room-filter ${isSelected ? 'active' : ''} ${isIneligible || isUnknown ? 'locked' : ''}`}
                onClick={() => {
                  if (!isIneligible && !isUnknown) setSelectedDrawType(type);
                }}
                disabled={isIneligible || isUnknown}
                title={eligibility.reason}
                style={isSelected && !isIneligible ? {
                  borderColor: DRAW_TYPE_COLORS[type] || '#64748b',
                  color: DRAW_TYPE_COLORS[type] || '#64748b',
                } : {}}
              >
                {type === 'all' ? 'All Draws' : type}
                {(isIneligible || isUnknown) && <span style={{ marginLeft: '6px', fontSize: '10px' }}>🔒</span>}
              </button>
            );
          })}
        </div>

        {/* Invitation Stats */}
        <div className="war-room-stats">
          <div className="war-room-stat">
            <span className="stat-number" style={{
              color: invitationStats.percentage >= 50 ? '#10b981' :
                invitationStats.percentage > 0 ? '#f59e0b' : '#ef4444'
            }}>
              {invitationStats.invited}/{invitationStats.total}
            </span>
            <span className="stat-label">draws invited</span>
          </div>
          <div className="war-room-stat">
            <span className="stat-number">{invitationStats.lowestCutoff} – {invitationStats.highestCutoff}</span>
            <span className="stat-label">cutoff range</span>
          </div>
          <div className="war-room-stat">
            <span className="stat-number">{invitationStats.avgCutoff}</span>
            <span className="stat-label">avg cutoff</span>
          </div>
          <div className="war-room-stat">
            <span className="stat-number" style={{
              color: userScore >= invitationStats.avgCutoff ? '#10b981' : '#ef4444'
            }}>
              {userScore >= invitationStats.avgCutoff ? '+' : ''}{userScore - invitationStats.avgCutoff}
            </span>
            <span className="stat-label">vs avg</span>
          </div>
        </div>

        {/* Chart */}
        <div className="war-room-chart">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 30', 'dataMax + 30']}
                />
                <Tooltip
                  content={<ChartTooltip />}
                />
                <ReferenceLine
                  y={userScore}
                  stroke="#10b981"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{
                    value: `Your Score: ${userScore}`,
                    fill: '#10b981',
                    fontSize: 12,
                    fontWeight: 600,
                    position: 'right',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cutoff"
                  fill="rgba(99, 102, 241, 0.08)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="cutoff"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6, fill: '#818cf8' }}
                  name="Draw Cutoff"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="war-room-no-data">No draw data available for "{selectedDrawType}".</div>
          )}
        </div>

        <p className="war-room-context">
          {invitationStats.percentage >= 80
            ? `🎉 With ${userScore} points, you would have been invited in most recent ${selectedDrawType === 'all' ? '' : selectedDrawType + ' '}draws. Your chances are excellent.`
            : invitationStats.percentage >= 40
              ? `⚡ With ${userScore} points, you're competitive but not guaranteed. Improving your score by ${invitationStats.avgCutoff - userScore + 10} points would significantly increase your chances.`
              : invitationStats.total > 0
                ? `⚠️ With ${userScore} points, you would need about ${invitationStats.avgCutoff - userScore} more points to be competitive. See the improvement scenarios below.`
                : `📊 Select a draw type above to see how your score compares.`
          }
        </p>
      </div>

      {/* ══════ Section 2: Point Maximization Simulator ══════ */}
      <div className="war-room-section">
        <h3 className="war-room-title">
          🎯 Point Maximization Simulator
          <span className={`war-room-badge ${hasWarRoomAccess ? 'paid' : 'locked'}`}>
            {hasWarRoomAccess ? 'Optimize' : '🔒 Optimize'}
          </span>
        </h3>

        <div className="scenarios-grid">
          {scenarios.slice(0, hasWarRoomAccess ? scenarios.length : 1).map((scenario, idx) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              isExpanded={expandedScenario === scenario.id}
              onToggle={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
              rank={idx + 1}
            />
          ))}
        </div>
      </div>

      {/* ══════ Locked Content (Non-Paid Only) ══════ */}
      {!hasWarRoomAccess && (scenarios.length > 1 || noc.code) && (
        <div className="war-room-locked-wrapper">
          <div className="war-room-locked-blur">
            {scenarios.length > 1 && (
              <div className="scenarios-grid" style={{ marginBottom: '2.5rem' }}>
                {scenarios.slice(1).map((scenario, idx) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    isExpanded={false}
                    onToggle={() => {}}
                    rank={idx + 2}
                  />
                ))}
              </div>
            )}

            {noc.code && (
              <div className="war-room-section" style={{ pointerEvents: 'none' }}>
                <h3 className="war-room-title">
                  🏷️ Category-Based Draw Matcher
                  <span className="war-room-badge locked">🔒 Optimize</span>
                </h3>
                <div className="category-matches">
                  <div className="category-no-match">
                    <p>
                      Your NOC code <strong>{noc.code}</strong> is currently being analyzed against all category-based draws.
                      Unlock to see your personalized matches and cutoffs.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div id="war-room-paywall" className="war-room-unlock-sticky">
            <div className="war-room-unlock-content">
              {unlockCTA || (
                <>
                  <div className="pricing-grid-2" style={{ marginTop: '1rem', marginBottom: '0' }}>
                    {/* Card 1: Single Unlock */}
                    <div className="pricing-card" style={{ background: '#ffffff' }}>
                      <div className="pricing-card-header">
                        <h3>CRS Point Simulator Pass</h3>
                        <div className="pricing-price">$19 <span>CAD</span></div>
                        <p className="pricing-desc">Unlock these CRS features instantly.</p>
                      </div>
                      <ul className="pricing-features">
                        <Feature included>1x Simulator Unlock</Feature>
                        <Feature included>Category Matcher</Feature>
                        <Feature included>Detailed What-If Scenarios</Feature>
                        <Feature highlight>No Letter Audits Included</Feature>
                      </ul>
                      <div className="pricing-card-footer">
                        <button 
                          className="pricing-btn secondary" 
                          disabled={isCheckoutLoading}
                          onClick={async () => {
                            try {
                              setIsCheckoutLoading(true);
                              const token = await getToken();
                              if (token) {
                                const result = await createCheckoutSession('war_room', token, '/crs-calculator');
                                if (result?.session_url) window.location.href = result.session_url;
                              } else {
                                navigate('/pricing');
                              }
                            } catch (e) {
                              console.error('Checkout error:', e);
                              navigate('/pricing');
                            } finally {
                              setIsCheckoutLoading(false);
                            }
                          }}
                        >
                          {isCheckoutLoading ? 'Redirecting...' : 'Get CRS Point Simulator Pass — $19 CAD'}
                        </button>
                      </div>
                    </div>

                    {/* Card 2: Optimize Tier */}
                    <div className="pricing-card featured animate-reveal delay-1">
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
                        <button 
                          className="pricing-btn primary" 
                          disabled={isCheckoutLoading}
                          onClick={async () => {
                            try {
                              setIsCheckoutLoading(true);
                              const token = await getToken();
                              if (token) {
                                const result = await createCheckoutSession('starter', token, '/crs-calculator');
                                if (result?.session_url) window.location.href = result.session_url;
                              } else {
                                navigate('/pricing');
                              }
                            } catch (e) {
                              console.error('Checkout error:', e);
                              navigate('/pricing');
                            } finally {
                              setIsCheckoutLoading(false);
                            }
                          }}
                        >
                          {isCheckoutLoading ? 'Redirecting...' : 'Get Optimize — $49 CAD'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ Section 3: Category-Based Draw Matcher (Paid Only) ══════ */}
      {hasWarRoomAccess && noc.code && (
        <div className="war-room-section">
          <h3 className="war-room-title">
            🏷️ Category-Based Draw Matcher
            <span className="war-room-badge paid">Optimize</span>
          </h3>

          <div className="category-matches">
            {categoryMatches.length > 0 ? (
              <>
                <p className="category-intro">
                  Your NOC <strong>{noc.code}</strong> ({noc.title}) qualifies for these category-based draws with potentially <strong>lower CRS cutoffs</strong>:
                </p>
                {categoryMatches.map(match => (
                  <div
                    key={match.info.name}
                    className={`category-card ${match.scoreDiff >= 0 ? 'above' : 'below'}`}
                  >
                    <div className="category-card-header">
                      <span className="category-icon">{match.info.icon}</span>
                      <div>
                        <h4>{match.info.name}</h4>
                        <p>{match.info.description}</p>
                      </div>
                    </div>
                    <div className="category-card-stats">
                      <div className="category-stat">
                        <span className="category-stat-label">Avg Cutoff (2025)</span>
                        <span className="category-stat-value">{match.info.avgCutoff2025}</span>
                      </div>
                      <div className="category-stat">
                        <span className="category-stat-label">Your Score</span>
                        <span className="category-stat-value">{userScore}</span>
                      </div>
                      <div className={`category-stat diff ${match.scoreDiff >= 0 ? 'positive' : 'negative'}`}>
                        <span className="category-stat-label">Difference</span>
                        <span className="category-stat-value">
                          {match.scoreDiff >= 0 ? '+' : ''}{match.scoreDiff}
                        </span>
                      </div>
                    </div>
                    {match.scoreDiff >= 0 ? (
                      <div className="category-status positive">
                        ✅ You're above the average cutoff for {match.info.name} draws!
                      </div>
                    ) : (
                      <div className="category-status negative">
                        ⚠️ You need ~{Math.abs(match.scoreDiff)} more points.
                        Category draws often have lower cutoffs than general draws.
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="category-no-match">
                <p>
                  Your NOC code <strong>{noc.code}</strong> is not currently part of any category-based draw.
                  You'll be competing in <strong>general draws</strong> (or PNP draws if you have a provincial nomination).
                </p>
                <p style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.4)' }}>
                  Note: IRCC updates category eligibility periodically. Check the latest lists on canada.ca.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Chart Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const diff = data.userScore - data.cutoff;
  const qualified = diff >= 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.85rem',
      color: '#e2e8f0',
      minWidth: '160px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>{label}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>
        {data.drawType} Draw
      </div>
      <div style={{ color: '#6366f1', marginBottom: '2px' }}>
        Draw Cutoff: {data.cutoff}
      </div>
      <div style={{
        color: qualified ? '#10b981' : '#ef4444',
        fontWeight: 600,
      }}>
        {qualified ? `✅ You qualify (+${diff})` : `❌ ${Math.abs(diff)} pts short`}
      </div>
      {data.invitations > 0 && (
        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
          {data.invitations.toLocaleString()} ITAs issued
        </div>
      )}
    </div>
  );
}

// ── Scenario Card ──

function ScenarioCard({
  scenario,
  isExpanded,
  onToggle,
  rank,
}: {
  scenario: ImprovementScenario;
  isExpanded: boolean;
  onToggle: () => void;
  rank: number;
}) {

  const categoryIcons: Record<string, string> = {
    language: '🗣️',
    education: '🎓',
    experience: '💼',
    additional: '⭐',
    spouse: '💗',
    urgency: '⏳',
  };

  return (
    <div className={`scenario-card ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
      <div className="scenario-header">
        <div className="scenario-rank">#{rank}</div>
        <div className="scenario-info">
          <span className="scenario-category-icon">{categoryIcons[scenario.category] || '📋'}</span>
          <h4>{scenario.title}</h4>
        </div>
        <div 
          className="scenario-points" 
          style={scenario.pointsGained < 0 ? { color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' } : undefined}
        >
          {scenario.pointsGained > 0 ? '+' : ''}{scenario.pointsGained}
        </div>
      </div>

      {isExpanded && (
        <div className="scenario-details">
          <p>{scenario.description}</p>
          <div className="scenario-meta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px', fontSize: '0.85rem' }}>
            <span className="scenario-impact-badge" style={{ 
                background: scenario.impact === 'high' ? '#fef3c7' : scenario.impact === 'medium' ? '#e0f2fe' : '#f1f5f9',
                color: scenario.impact === 'high' ? '#b45309' : scenario.impact === 'medium' ? '#0369a1' : '#475569',
                padding: '4px 10px', borderRadius: '8px', fontWeight: 600, textTransform: 'capitalize' 
            }}>
              {scenario.impact}
            </span>
            <span className="scenario-time" style={{ color: '#64748b' }}>⏱️ {scenario.timeNeeded}</span>
            <span className="scenario-cost" style={{ color: '#64748b' }}>💰 {scenario.cost}</span>
            <span className="scenario-effort" style={{ color: '#64748b' }}>
              📈 {scenario.effortLevel} effort
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
