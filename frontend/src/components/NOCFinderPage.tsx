import { type FC, type ReactNode, useState, useRef, useEffect } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { findNOCCode, reevaluateDocument, createCheckoutSession, fetchUserCredits, revealNocResult, friendlyError } from '../services/api';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';
import { useJourneyStore } from '../stores/journeyStore';
import ReactGA from 'react-ga4';

interface AlternativeNOC {
  code: string;
  title: string;
  confidence: number;
}

interface DutyMatch {
  noc_duty: string;        // official NOC main duty
  letter_evidence: string; // the applicant's matching evidence (empty if missing)
  match: 'strong' | 'partial' | 'weak' | 'missing';
}

interface NOCResult {
  document_valid: boolean;
  rejection_reason: string;
  result_type: 'STRONG_MATCH' | 'MODERATE_MATCH' | 'NO_MATCH';
  noc_code: string;
  noc_title: string;
  confidence: number;
  teer_category: string;
  cec_eligible: boolean;
  confidence_level: 'high' | 'medium' | 'low';
  why_this_noc: string;
  key_matches: string[];
  key_gaps: string[];
  alternatives: AlternativeNOC[];
  input_reliability: 'high' | 'medium' | 'low';
  location_of_experience?: 'canada' | 'outside_canada' | 'unknown';
  important_note: string;
  next_step: string;
  stored_file_id?: string;
  is_signed_in?: boolean;
  // Monetization gating (from backend)
  gated?: boolean;
  gate_reason?: 'signin' | 'upgrade';
  finder_credits_remaining?: number | null;
  gaps_count?: number;
  alt_count?: number;
  tier?: string;
  from_file?: boolean; // true when this result came from a document upload (vs typed text)
  requires_payment?: boolean; // gate-only response: no report produced, user must pay to run
  duty_coverage?: number; // % of the NOC's official duties evidenced (the hero gauge)
  coverage_subtitle?: string; // sub-occupation the coverage is scoped to (multi-title NOCs)
  duties_breakdown?: DutyMatch[];
  breakdown_count?: number;
  engine_tier?: string; // 'premium' when the backend ran the paid-tier AI model
}

interface NOCFinderPageProps {
  onNavigate: (page: string, state?: any) => void;
}

const nocSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa NOC Matcher AI",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  },
  "description": "AI-powered tool that matches your job duties to the correct Canadian NOC 2021 code for Express Entry. Analyzes all 516 unit groups in seconds."
});

export const NOCFinderPage: FC<NOCFinderPageProps> = ({ onNavigate }) => {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const [jobTitle, setJobTitle] = useState('');
  const [duties, setDuties] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const setNoc = useJourneyStore((s) => s.setNoc);
  
  const [loading, setLoading] = useState(false);
  // Initialize from sessionStorage so result survives a Stripe redirect
  const [result, setResult] = useState<NOCResult | null>(() => {
    const saved = sessionStorage.getItem('nocFinderResult');
    return saved ? JSON.parse(saved) : null;
  });

  // Re-read from sessionStorage when navigating here from My Evaluations
  // (replaces the old window.location.reload() hack)
  useEffect(() => {
    if ((location.state as any)?.fromHistory) {
      const saved = sessionStorage.getItem('nocFinderResult');
      if (saved) {
        setResult(JSON.parse(saved));
        // Auto-scroll to results after React renders the card
        setTimeout(() => {
          document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
      // Clear the state to prevent re-triggering on subsequent renders
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(location.state as any)?.fromHistory]);
  const [error, setError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [targetNocOverride, setTargetNocOverride] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [manualNoc, setManualNoc] = useState('');
  // The signed-in user's current finder entitlement (so we can gate BEFORE spending an API call).
  const [finderCredits, setFinderCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  const isPaidTier = userTier === 'starter' || userTier === 'complete';
  useEffect(() => {
    if (!isSignedIn) { setFinderCredits(null); setUserTier('free'); return; }
    (async () => {
      const tk = await getToken(); if (!tk) return;
      const c = await fetchUserCredits(tk);
      setFinderCredits(typeof c.find_noc_credits === 'number' ? c.find_noc_credits : 0);
      setUserTier(c.subscription_tier || 'free');
    })();
  }, [isSignedIn, getToken]);
  // True when a signed-in free user has exhausted their free reports → gate before running anything.
  const outOfCredits = !!isSignedIn && !isPaidTier && finderCredits !== null && finderCredits <= 0;
  // Clear a STALE payment gate: if a "buy a pack / upgrade" paywall is showing from a previous visit
  // (persisted in sessionStorage) but the user now actually has finder credits or a paid tier, drop it
  // so they see the tool instead of a dead CTA — this survives a hard refresh too.
  useEffect(() => {
    const hasAccess = isPaidTier || (finderCredits ?? 0) > 0;
    if (hasAccess && result && (result.requires_payment || result.gate_reason === 'upgrade')) {
      sessionStorage.removeItem('nocFinderResult');
      setResult(null);
    }
  }, [finderCredits, isPaidTier, result]);
  // Code -> official title map (from the public NOC directory) for the manual re-eval auto-populate.
  const [nocTitles, setNocTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/noc-directory.json')
      .then(r => r.json())
      .then((list: { code: string; title: string }[]) => {
        const m: Record<string, string> = {};
        for (const n of list) m[n.code] = n.title;
        setNocTitles(m);
      })
      .catch(() => {});
  }, []);
  const manualNocTitle = nocTitles[manualNoc] || '';
  const manualNocValid = /^\d{5}$/.test(manualNoc) && !!manualNocTitle;

  // Reusable paywall card (credit packs + Optimize) — used both as the in-result overlay and as a
  // standalone "out of reports" panel when we gate BEFORE running the finder.
  const renderPaywallCard = (subtext: ReactNode) => (
    <div className="card" style={{ width: '100%', maxWidth: '540px', background: 'white', border: '2px solid var(--primary-color)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', margin: '0 auto' }}>
      <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🔓</div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '4px' }}>Unlock your full NOC report</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5, fontSize: '0.9rem' }}>{subtext}</p>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', textAlign: 'left' }}>Just need your NOC? Pick a pack to continue</div>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        {[
          { pt: 'finder_1' as const, credits: 1, price: 9.90 },
          { pt: 'finder_3' as const, credits: 3, price: 14.90, best: true },
          { pt: 'finder_5' as const, credits: 5, price: 19.90 },
        ].map(p => (
          <button key={p.pt} onClick={() => handleCheckout(p.pt, p.price)} disabled={!!checkingOut}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
              border: p.best ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: p.best ? '#EEF2FF' : 'white' }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              {p.credits} full report{p.credits > 1 ? 's' : ''} {p.best && <span style={{ fontSize: '0.66rem', color: '#4338CA', background: '#E0E7FF', padding: '2px 6px', borderRadius: '999px', marginLeft: '4px' }}>BEST VALUE</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>{`$${p.price.toFixed(2)}`}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white', background: 'var(--primary-color)', padding: '5px 12px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                {checkingOut === p.pt ? 'Redirecting…' : 'Continue →'}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
        🔒 You'll be taken to our secure Stripe checkout to pay.
      </p>
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', textAlign: 'left' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Doing the whole application?</div>
        <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '1rem' }} onClick={() => handleCheckout('starter', 49)} disabled={!!checkingOut}>
          {checkingOut === 'starter' ? 'Redirecting…' : 'Get Optimize — $49 · unlimited everything →'}
        </button>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
          Unlimited NOC reports + Employment Letter Auditor + Smart Tracker + CRS Simulator + AI Assistant + Document tools + 1 free GCMS notes order.
        </p>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>One-time payment · 3-day money-back guarantee · credits are non-refundable once used</p>
    </div>
  );

  // "Audit my letter" handoff: a file upload can be audited directly (existing auto-run flow);
  // text/manual input has no real letter to audit, so just open the Auditor page.
  const goToAuditor = () => {
    if (result?.from_file && result?.stored_file_id) {
      onNavigate('audit-employment-letter', { fileId: result.stored_file_id, targetNoc: result.noc_code });
    } else {
      // Text/manual input is NOT an employment letter — open the Auditor's upload page fresh
      // (resetAudit clears any stale audit result so we don't show a previous analysis).
      onNavigate('audit-employment-letter', { resetAudit: true });
    }
  };

  // Send an out-of-credits user to Stripe — either a NOC credit pack or the full Optimize tier.
  const handleCheckout = async (passType: 'finder_1' | 'finder_3' | 'finder_5' | 'starter', value: number) => {
    const label = passType === 'starter' ? 'Optimize' : passType;
    ReactGA.event('begin_checkout', { currency: 'CAD', value, items: [{ item_id: passType, item_name: label, price: value }] });
    setCheckingOut(passType);
    try {
      const token = await getToken();
      if (!token) { onNavigate('pricing'); return; }
      const res = await createCheckoutSession(passType, token, '/find-my-noc');
      if (res?.session_url) window.location.href = res.session_url;
      else onNavigate('pricing');
    } catch {
      onNavigate('pricing');
    } finally {
      setCheckingOut(null);
    }
  };

  // After a SUCCESSFUL payment, re-run the last search so the now-unlocked full report replaces the
  // gated teaser. (On CANCEL, we do nothing — the gated result persists in sessionStorage, so the
  // paywall + blur stay exactly as they were.)
  const didPaymentRerun = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') !== 'true') return;
    // Strip the param either way so a refresh doesn't re-trigger.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('payment_success');
    window.history.replaceState({}, '', cleanUrl.toString());
    if (didPaymentRerun.current || !isSignedIn) return;
    didPaymentRerun.current = true;
    const ls = sessionStorage.getItem('nocLastSearch');
    if (!ls) return;
    try {
      const s = JSON.parse(ls);
      if (s.fromFile && s.fileId) reEvaluateWithStoredFile(s.fileId, s.targetNoc || '');
      else if (s.title || s.duties) processInput(null, s.title || '', s.duties || '', s.targetNoc || '');
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Once signed in with a gated result on screen, decide entitlement on the SERVER (no AI re-run):
  // paid/credit users reveal the full report (one credit); users with no credits get the upgrade
  // teaser. Fires whenever a gated result meets a signed-in session — sign-in transition, page
  // (re)mount after a Clerk redirect, everything — not just the in-place transition. Right after
  // sign-UP Clerk's token can lag by a moment, so getToken is retried; the server reveal is
  // idempotent (an already-unlocked record never costs a second credit), making retries safe.
  const revealInFlight = useRef(false);
  useEffect(() => {
    if (!isSignedIn || revealInFlight.current) return;

    let cur: NOCResult | null = result;
    if (!cur) {
      const saved = sessionStorage.getItem('nocFinderResult');
      if (saved) { try { cur = JSON.parse(saved); } catch { /* ignore */ } }
    }
    // Only 'signin'-gated results need a server decision; 'upgrade'-gated ones already had it.
    if (!cur || !cur.gate_reason || cur.gate_reason === 'upgrade' || !cur.stored_file_id) return;

    revealInFlight.current = true;
    (async () => {
      try {
        let token: string | null = null;
        for (let i = 0; i < 5 && !token; i++) {
          token = await getToken().catch(() => null);
          if (!token) await new Promise(r => setTimeout(r, 700));
        }
        if (!token || !cur) { revealInFlight.current = false; return; }

        const r = await revealNocResult(token, cur.stored_file_id!);
        setUserTier(r.tier);
        setFinderCredits(r.finder_credits_remaining ?? 0);

        if (r.access === 'full' && r.result) {
          // The gated response had the NOC code stripped; use the server's full result to reveal it.
          const full = { ...mapApiResponse(r.result), from_file: cur.from_file };
          setResult(full);
          sessionStorage.setItem('nocFinderResult', JSON.stringify(full));
          setNoc({ code: full.noc_code, title: full.noc_title, teerCategory: full.teer_category, cecEligible: full.cec_eligible, confidence: full.confidence });
        } else {
          // Existing user with no credits → keep only the duty-coverage gauge visible; code stays hidden.
          const gated: NOCResult = { ...cur, is_signed_in: true, gated: true, gate_reason: 'upgrade', finder_credits_remaining: 0 };
          setResult(gated);
          sessionStorage.setItem('nocFinderResult', JSON.stringify(gated));
        }
        setTimeout(() => document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      } catch {
        revealInFlight.current = false; // network hiccup — allow the next render to retry
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, result]);

  /** Map raw backend v2 response to our local NOCResult interface */
  const mapApiResponse = (rawData: any): NOCResult => {
    const noc_code = rawData.recommended_noc?.code || '';
    const teer = noc_code.length >= 2 ? noc_code.charAt(1) : '';
    const cec = ['0', '1', '2', '3'].includes(teer);

    return {
      document_valid: rawData.document_valid,
      rejection_reason: rawData.rejection_reason || '',
      result_type: rawData.result_type || 'NO_MATCH',
      noc_code,
      noc_title: rawData.recommended_noc?.title || '',
      confidence: rawData.recommended_noc?.confidence || 0,
      teer_category: teer,
      cec_eligible: cec,
      confidence_level: rawData.confidence_level || 'low',
      why_this_noc: rawData.why_this_noc || '',
      key_matches: rawData.key_matches || [],
      key_gaps: rawData.key_gaps || [],
      alternatives: (rawData.alternatives || []).map((a: any) => ({
        code: a.code || a.noc_code || '',
        title: a.title || a.noc_title || '',
        confidence: a.confidence || a.match_score || 0,
      })),
      input_reliability: rawData.input_reliability || 'medium',
      location_of_experience: rawData.location_of_experience || 'unknown',
      important_note: rawData.important_note || '',
      next_step: rawData.next_step || '',
      stored_file_id: rawData.stored_file_id,
      is_signed_in: !!rawData.is_signed_in,
      gated: !!rawData.gated,
      gate_reason: rawData.gate_reason,
      finder_credits_remaining: rawData.finder_credits_remaining ?? null,
      gaps_count: rawData.gaps_count ?? (rawData.key_gaps || []).length,
      alt_count: rawData.alt_count ?? (rawData.alternatives || []).length,
      tier: rawData.tier,
      duty_coverage: typeof rawData.duty_coverage === 'number'
        ? rawData.duty_coverage
        : (rawData.recommended_noc?.duties_total ? Math.round(100 * (rawData.recommended_noc.duties_matched || 0) / rawData.recommended_noc.duties_total) : 0),
      coverage_subtitle: rawData.coverage_subtitle || '',
      duties_breakdown: (rawData.duties_breakdown || []).map((d: any) => ({
        noc_duty: d.noc_duty || '',
        letter_evidence: d.letter_evidence || d.letter_duty || '',
        match: d.match || 'missing',
      })),
      breakdown_count: rawData.breakdown_count ?? (rawData.duties_breakdown || []).length,
      engine_tier: rawData.engine_tier,
    };
  };

  const processInput = async (inputFile: File | null, inputTitle: string = '', inputDuties: string = '', targetNoc: string = '') => {
    // If we have a stored file from a previous analysis and no local file/text, use the reevaluate endpoint
    if (!inputFile && (!inputTitle.trim() || !inputDuties.trim()) && targetNoc && result?.stored_file_id) {
      return reEvaluateWithStoredFile(result.stored_file_id, targetNoc);
    }
    
    if (!inputFile && (!inputTitle.trim() || !inputDuties.trim())) {
      setError('Please either upload a document OR fill in your job title and duties.');
      return;
    }
    
    if (inputFile && inputFile.size > 5 * 1024 * 1024) {
      setError('File is too large. The maximum file size allowed is 5MB.');
      return;
    }

    // Out of free reports → show the payment gate WITHOUT calling the backend (no API/model cost).
    // After a successful purchase the payment_success effect re-runs this search to produce the report.
    if (outOfCredits) {
      const gate: NOCResult = {
        document_valid: true, rejection_reason: '', result_type: 'NO_MATCH',
        noc_code: '', noc_title: '', confidence: 0, teer_category: '', cec_eligible: false,
        confidence_level: 'low', why_this_noc: '', key_matches: [], key_gaps: [], alternatives: [],
        input_reliability: 'medium', important_note: '', next_step: '',
        gated: true, gate_reason: 'upgrade', requires_payment: true,
        finder_credits_remaining: 0, tier: userTier, from_file: !!inputFile,
      };
      setResult(gate);
      sessionStorage.setItem('nocFinderResult', JSON.stringify(gate));
      sessionStorage.setItem('nocLastSearch', JSON.stringify({ title: inputTitle, duties: inputDuties, targetNoc, fileId: '', fromFile: !!inputFile }));
      setTimeout(() => document.getElementById('noc-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return;
    }

    setError('');
    setLoading(true);
    if (targetNoc) {
      setTargetNocOverride(targetNoc);
      // Scroll to the loading/results area so the user sees progress
      setTimeout(() => {
        document.getElementById('noc-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setTargetNocOverride(null);
      setResult(null);
    }

    try {
      const token = isSignedIn ? (await getToken() || '') : '';
      let rawData;
      if (inputFile) {
        rawData = await findNOCCode(undefined, undefined, inputFile, targetNoc, token);
      } else {
        rawData = await findNOCCode(inputTitle.trim(), inputDuties.trim(), undefined, targetNoc, token);
      }
      
      if (rawData.document_valid && rawData.recommended_noc) {
        const mapped = mapApiResponse(rawData);
        mapped.from_file = !!inputFile; // remember whether this came from a real document
        setResult(mapped);
        // Land the user on the NOC match itself, not wherever they happened to be on the page.
        setTimeout(() => {
          (document.getElementById('primary-match-section') || document.getElementById('noc-results-area'))
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 250);
        ReactGA.event("tool_engagement", { tool_name: "NOC Finder" });
        sessionStorage.setItem('nocFinderResult', JSON.stringify(mapped));
        // Remember the inputs so we can re-run (reveal full report) after a successful payment.
        sessionStorage.setItem('nocLastSearch', JSON.stringify({
          title: inputTitle, duties: inputDuties, targetNoc, fileId: mapped.stored_file_id, fromFile: !!inputFile,
        }));
        // Write to journey store so progress bar updates
        setNoc({
          code: mapped.noc_code,
          title: mapped.noc_title,
          teerCategory: mapped.teer_category,
          cecEligible: mapped.cec_eligible,
          confidence: mapped.confidence,
        });
        // Backend /api/v1/noc-finder already persists evaluation for signed-in users — no need to double-save
      } else {
        setResult({
          document_valid: false,
          rejection_reason: rawData.rejection_reason || 'Could not validate input.',
          result_type: 'NO_MATCH',
          noc_code: '',
          noc_title: '',
          confidence: 0,
          teer_category: '',
          cec_eligible: false,
          confidence_level: 'low',
          why_this_noc: '',
          key_matches: [],
          key_gaps: [],
          alternatives: [],
          input_reliability: 'low',
          location_of_experience: 'unknown',
          important_note: '',
          next_step: '',
        });
      }
    } catch (e) {
      setError(friendlyError(e, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const reEvaluateWithStoredFile = async (fileId: string, targetNoc: string) => {
    setError('');
    setLoading(true);
    setTargetNocOverride(targetNoc);
    // Scroll to the loading/results area so the user sees progress
    setTimeout(() => {
      document.getElementById('noc-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    try {
      const token = await getToken() || '';
      const rawData = await reevaluateDocument(fileId, targetNoc, token, 'noc_finder');
      
      if (rawData.recommended_noc || rawData.noc_analysis) {
        const mapped = mapApiResponse(rawData);
        mapped.stored_file_id = rawData.stored_file_id || fileId;
        mapped.is_signed_in = !!rawData.is_signed_in || !!result?.is_signed_in;
        // A re-evaluation is always on a stored document — preserve from_file so the "Audit my letter"
        // CTA still auto-runs the auditor afterward (otherwise it opens a blank upload page). Fixes #3.
        mapped.from_file = result?.from_file ?? true;
        setResult(mapped);
        // Update journey store with re-evaluated NOC
        setNoc({
          code: mapped.noc_code,
          title: mapped.noc_title,
          teerCategory: mapped.teer_category,
          cecEligible: mapped.cec_eligible,
          confidence: mapped.confidence,
        });
        // Re-evaluations are already saved by backend, no need to double-save
      } else {
        setError('Re-evaluation returned no NOC analysis. Please try again.');
      }
    } catch (e) {
      setError(friendlyError(e, 'Re-evaluation failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setJobTitle('');
      setDuties('');
      setError('');
      processInput(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setJobTitle('');
      setDuties('');
      setError('');
      processInput(droppedFile);
    }
  };

  const handleSubmit = () => {
    processInput(file, jobTitle, duties);
  };

  // Helpers for match styling
  const getMatchBadge = (type: string) => {
    switch (type) {
      case 'STRONG_MATCH': return { label: 'Strong Match', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', icon: '✅' };
      case 'MODERATE_MATCH': return { label: 'Moderate Match', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: '⚠️' };
      default: return { label: 'Weak Match', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: '❌' };
    }
  };

  return (
    <div>
      <SEO 
        title="Find My NOC Code 2021 | AI NOC Matching Tool for Canada PR" 
        description="Don't guess your NOC code. Paste your job duties and our AI matches them to the correct NOC 2021 code for Express Entry. Results in under 60 seconds."
        canonical="/find-my-noc"
        schema={nocSchema}
      />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
      </div>
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🎯 Trusted by Express Entry applicants</div>
          <h1>Wrong NOC Code =<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>PR Refusal.</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            IRCC doesn't match your NOC by job title — they match it by your actual duties. If the duties on your letter don't align with the code you claim, your application gets refused. Paste your duties below and find the right code in under 60 seconds.
          </p>
          <a href="#noc-input" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
            Find My NOC Now
          </a>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⚡ <span style={{ color: 'var(--primary-light)' }}>Takes less than 60 seconds</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✅ 2 free reports to start</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {/* Input Card */}
            <div id="noc-input" className="info-card" style={{ padding: '36px 32px' }}>
              
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Upload your employment letter <span style={{ fontWeight: 400, color: '#64748B', fontSize: '0.9rem' }}>(fastest & most accurate)</span></h3>
                <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '16px' }}>
                  We'll automatically extract your job title and duties for the most accurate NOC match.
                </p>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: isDragActive ? '2px dashed var(--primary-color)' : '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragActive ? 'var(--primary-light)' : (file ? '#F8FAFC' : 'white'),
                    transition: 'all 0.2s ease',
                    boxShadow: isDragActive ? '0 0 10px rgba(0,0,0,0.05) inset' : 'none'
                  }}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                  {file ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>{file.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      <button style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Change File</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px' }}>Click to browse or drag and drop</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF, Word, JPG, PNG</div>
                    </>
                  )}
                </div>
              </div>

              {!file && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0' }}>
                    <div style={{ flex: 1, backgroundColor: 'var(--border-color)', height: '1px' }}></div>
                    <div style={{ padding: '0 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '1px' }}>OR</div>
                    <div style={{ flex: 1, backgroundColor: 'var(--border-color)', height: '1px' }}></div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Or paste your job duties</h3>
                    <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '20px' }}>
                      Don't have your letter handy? Just type your title and paste your duties. 
                    </p>
                    <div className="form-group">
                      <label className="form-label">Job Title</label>
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="e.g., Software Developer, Marketing Manager, Electrician"
                        value={jobTitle}
                        onChange={e => { setJobTitle(e.target.value); setFile(null); }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Main Duties & Responsibilities
                        <span className="form-label-hint"> — paste the exact duties from your letter</span>
                      </label>
                      <textarea 
                        className="form-textarea"
                        placeholder="Paste your job duties here (from your employment letter if available)..."
                        value={duties}
                        onChange={e => { setDuties(e.target.value); setFile(null); }}
                        rows={6}
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.9rem', marginBottom: '16px', padding: '10px 16px', background: '#FEF2F2', borderRadius: '8px' }}>
                  ⚠️ {error}
                </div>
              )}

              {loading ? (
                <div id="noc-results-area" style={{ marginTop: '32px' }}>
                  <DynamicLoader tool={targetNocOverride ? 'noc_retarget' : 'noc'} targetNoc={targetNocOverride || undefined} />
                </div>
              ) : !file && (
                <div>
                  <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>
                    Get your NOC code + match score instantly
                  </p>
                  <button 
                    className="btn btn-primary btn-lg" 
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }}
                  >
                    🔍 Find My NOC Now
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ 2 free reports to start</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Results in under 60 seconds</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Built for Express Entry applications</span>
                  </div>
                  <div style={{ marginTop: '24px', padding: '16px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46', marginBottom: '4px' }}>100% Official IRCC Data. Zero Hallucinations.</div>
                        <div style={{ fontSize: '0.8rem', color: '#047857', lineHeight: 1.5 }}>
                          Our model strictly cross-references your duties against the official NOC 2021 Version 1.0 Matrix.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* What You'll Get — shown only before a result */}
            {!result && !loading && (
              <div style={{ marginTop: '32px', padding: '28px 24px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>What You'll Get</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Your Correct NOC Code</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The single most accurate code for your duties</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📊</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Match Strength + Confidence</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>See how closely your duties align with the NOC</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Key Matches & Gaps</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Know exactly what aligns and what's weak</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔄</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Alternative NOC Options</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backup codes you can re-evaluate against</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Warning */}
            {result && !result.document_valid && (
              <div style={{ 
                marginTop: '32px', 
                padding: '28px', 
                background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', 
                borderRadius: '14px', 
                border: '1px solid #F59E0B',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#92400E', margin: 0 }}>
                    Document Could Not Be Processed
                  </h3>
                </div>
                <p style={{ fontSize: '0.95rem', color: '#78350F', lineHeight: 1.7, margin: 0 }}>
                  {result.rejection_reason}
                </p>
              </div>
            )}

            {/* Out-of-reports gate (no report was run — we gated before spending an API call) */}
            {result && result.gated && result.requires_payment && (
              <div id="noc-results-area" style={{ marginTop: '32px' }}>
                {renderPaywallCard("You've used your 2 free NOC reports. Unlock more to see your match, the gaps IRCC may flag, and to re-evaluate against any code.")}
              </div>
            )}

            {/* === RESULT CARD === (renders for full results, and for gated results that still have a
                 coverage gauge to show — the NOC code itself is stripped server-side until unlocked) */}
            {result && result.document_valid && !result.requires_payment && (result.noc_code || result.gated) && (() => {
              // Match strength is derived from the DUTY COVERAGE % shown in the gauge (same thresholds
              // we use elsewhere: ≥70 strong, ≥45 moderate, else weak) so the badge and gauge agree.
              const _cov = result.duty_coverage ?? 0;
              const badge = getMatchBadge(_cov >= 70 ? 'STRONG_MATCH' : _cov >= 45 ? 'MODERATE_MATCH' : 'NO_MATCH');
              return (
              <div id="primary-match-section" className="result-card" style={{ marginTop: '32px', position: 'relative' }}>

                {/* Header (always visible — anonymous users see the match strength as a teaser) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-color)' }}>
                      NOC Match Result
                    </h3>
                    {result.input_reliability !== 'high' && (
                      <span style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '4px', display: 'block' }}>
                        ⚠️ Input reliability: {result.input_reliability} — results based on a resume/manual input may be less precise
                      </span>
                    )}
                    {typeof result.finder_credits_remaining === 'number' && !result.gated && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        🎟️ {result.finder_credits_remaining} free full {result.finder_credits_remaining === 1 ? 'report' : 'reports'} left
                      </span>
                    )}
                    {result.engine_tier === 'premium' && !result.gated && (
                      <span style={{ fontSize: '0.75rem', color: '#4338CA', marginTop: '6px', display: 'inline-block', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '999px', padding: '3px 10px', fontWeight: 600 }}>
                        ⚡ Premium AI engine — as a paying member, your analysis ran on our most advanced, highest-accuracy model
                      </span>
                    )}
                  </div>
                  <span style={{ 
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                    whiteSpace: 'nowrap'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                {/* NOC code + title + the hero Duty-Coverage gauge */}
                <div style={{ display: 'flex', gap: '22px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {(() => {
                    const cov = Math.max(0, Math.min(100, result.duty_coverage ?? 0));
                    const col = cov >= 75 ? '#059669' : cov >= 50 ? '#D97706' : '#DC2626';
                    const R = 52, CIRC = 2 * Math.PI * R, off = CIRC * (1 - cov / 100);
                    return (
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: '128px', height: '128px' }} title="How many of this NOC's official main duties your experience demonstrates. IRCC expects you to perform a substantial number of them.">
                          <svg width="128" height="128" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--border-color)" strokeWidth="12" />
                            <circle cx="64" cy="64" r={R} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round"
                              strokeDasharray={CIRC} strokeDashoffset={off} transform="rotate(-90 64 64)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: col, lineHeight: 1 }}>{cov}%</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px', textAlign: 'center', lineHeight: 1.1 }}>NOC Duty<br />Coverage</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '140px', lineHeight: 1.3 }}>
                          of {result.gated ? 'this NOC' : (result.coverage_subtitle && result.coverage_subtitle !== result.noc_title ? <strong>{result.coverage_subtitle}</strong> : `NOC ${result.noc_code}`)}'s official duties
                        </div>
                      </div>
                    );
                  })()}
                  {/* Code + title + TEER — blurred + hidden (server-stripped) while gated; the gauge above stays sharp */}
                  <div style={{ flex: '1 1 220px', minWidth: 0, ...(result.gated ? { filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' } : {}) }}>
                    <div className="result-card-title" style={{ fontSize: '1.35rem' }}>NOC {result.gated ? '•••••' : result.noc_code}</div>
                    <div className="result-card-subtitle" style={{ marginBottom: '12px' }}>{result.gated ? 'Occupation hidden until unlocked' : result.noc_title}</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ padding: '8px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TEER</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{result.teer_category}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anonymous sign-in gate — inline, directly under the sharp gauge so the coverage %
                    and match strength stay visible as the hook. */}
                {result.gate_reason === 'signin' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '520px', background: 'white', border: '2px solid var(--primary-color)', textAlign: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }}>
                      <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🔒</div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px' }}>Your NOC match is ready</h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5, fontSize: '0.93rem' }}>
                        You're a <strong>{Math.max(0, Math.min(100, result.duty_coverage ?? 0))}% duty match</strong>. Create a free account to reveal your matched <strong>NOC code</strong> and unlock your first <strong>2 full reports</strong> — the duty-by-duty breakdown, the gaps IRCC may flag, and backup NOC options.
                      </p>
                      <SignInButton mode="modal" forceRedirectUrl="/find-my-noc" signUpForceRedirectUrl="/find-my-noc">
                        <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
                          Reveal My NOC — Free
                        </button>
                      </SignInButton>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>Takes about 10 seconds</p>
                    </div>
                  </div>
                )}

                {/* Upgrade gate (signed-in, out of credits) — like the sign-in gate, ONLY the duty
                    coverage stays visible; the NOC code, TEER, summary and breakdown are blurred. Shows
                    the credit-pack / Optimize paywall instead of the sign-in card. */}
                {result.gate_reason === 'upgrade' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    {renderPaywallCard(
                      <>You're a <strong>{Math.max(0, Math.min(100, result.duty_coverage ?? 0))}% duty match</strong>. Unlock to reveal your matched NOC code, the duty-by-duty breakdown, and the gaps IRCC may flag.</>
                    )}
                  </div>
                )}

                {/* Everything below the headline gauge is blurred while gated — the user sees the
                    coverage % + match strength as a teaser, then signs in / upgrades to reveal the rest. */}
                <div style={result.gated ? { filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' } : {}}>

                {/* Risk → Auditor cross-sell (shown on every result; sharper when the match isn't strong) */}
                {(() => {
                  const strong = (result.duty_coverage ?? 0) >= 70;
                  return (
                    <div
                      onClick={goToAuditor}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                        padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
                        background: strong ? '#F0F9FF' : '#FFF7ED',
                        border: `1px solid ${strong ? '#BAE6FD' : '#FED7AA'}`,
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{strong ? '🛡️' : '⚠️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: strong ? '#075985' : '#9A3412' }}>
                          {strong
                            ? 'Make it airtight before you submit'
                            : 'A wrong NOC is a top cause of PR refusal'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Run your employment letter through the Auditor to confirm your duties prove NOC {result.noc_code} the way IRCC checks.
                        </div>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>Audit my letter →</span>
                    </div>
                  );
                })()}

                {/* Summary (shortened "why this NOC" — first 2 sentences) */}
                {result.why_this_noc && (
                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Summary</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-color)' }}>
                      {result.why_this_noc.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')}
                    </p>
                  </div>
                )}

                {/* Key Gaps + Alternatives — gated for anon (sign-in) and out-of-credit free users (upgrade) */}
                <div style={{ position: 'relative' }}>
                  <div style={result.gated ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 } : {}}>
                    {/* Duty-by-duty breakdown: each letter duty → closest official NOC duty + verdict */}
                    {result.duties_breakdown && result.duties_breakdown.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>Duty-by-duty breakdown</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {result.duties_breakdown.map((d, i) => {
                            const cfg = d.match === 'strong'
                              ? { bg: '#F0FDF4', bd: '#BBF7D0', c: '#059669', label: 'Strong', icon: '✅' }
                              : d.match === 'partial'
                              ? { bg: '#FFFBEB', bd: '#FDE68A', c: '#D97706', label: 'Partial', icon: '🟡' }
                              : d.match === 'weak'
                              ? { bg: '#FFF7ED', bd: '#FED7AA', c: '#EA580C', label: 'Weak', icon: '⚠️' }
                              : { bg: '#FEF2F2', bd: '#FECACA', c: '#DC2626', label: 'Missing', icon: '⛔' };
                            return (
                              <div key={i} style={{ padding: '12px 14px', background: cfg.bg, border: `1px solid ${cfg.bd}`, borderRadius: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                  <div style={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.45 }}>{d.letter_evidence}</div>
                                  <span style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, color: cfg.c, whiteSpace: 'nowrap' }}>{cfg.icon} {cfg.label}</span>
                                </div>
                                {d.noc_duty && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
                                    ↳ Matches official NOC duty: {d.noc_duty}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Placeholder rows when the real gaps/alternatives were stripped server-side (upgrade gate) */}
                    {result.gated && result.gate_reason === 'upgrade' && (
                      <div style={{ marginBottom: '20px' }}>
                        {(result.breakdown_count ?? 0) > 0 && (
                          <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>Duty-by-duty breakdown ({result.breakdown_count})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {Array.from({ length: Math.min(result.breakdown_count ?? 0, 4) }).map((_, i) => (
                                <div key={i} style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.88rem' }}>
                                  ████████████ ██████████ ███████ — ✅ Match
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#DC2626' }}>⚠️</span> Gaps / Missing Areas ({result.gaps_count ?? 0})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Array.from({ length: Math.max(result.gaps_count ?? 0, 1) }).map((_, i) => (
                            <div key={i} style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '0.88rem', lineHeight: 1.5 }}>
                              NOC duty not covered: ████████████████ ███████ ████████████
                            </div>
                          ))}
                        </div>
                        {(result.alt_count ?? 0) > 0 && (
                          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Other Potential Matches ({result.alt_count}):</h4>
                            {Array.from({ length: result.alt_count ?? 0 }).map((_, i) => (
                              <div key={i} style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px', fontWeight: 600, fontSize: '0.95rem' }}>
                                NOC █████ — ████████████████████
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {result.key_gaps && result.key_gaps.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#DC2626' }}>⚠️</span> Gaps / Missing Areas
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {result.key_gaps.map((gap, i) => (
                            <div key={i} style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '0.88rem', lineHeight: 1.5 }}>
                              {gap}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alternatives */}
                    {result.alternatives && result.alternatives.length > 0 && (
                      <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Other Potential Matches:</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Not sure about the primary match? Click any code below to re-evaluate against that NOC.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {result.alternatives.map((alt, i) => (
                            <div
                              key={i}
                              onClick={() => processInput(file, jobTitle, duties, alt.code)}
                              className="alternative-noc-card"
                              style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NOC {alt.code} — {alt.title}</div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }} className="target-btn">Re-evaluate →</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* (Upgrade paywall is rendered inline under the gauge — see above. The breakdown/gaps
                      here stay blurred as the backdrop.) */}
                </div>

                {/* Manual re-evaluation — check duties against a specific NOC code the user types */}
                {!result.gated && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px' }}>Have a specific NOC in mind?</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                      Enter any 5-digit NOC 2021 code to check your duties against it.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={manualNoc}
                        onChange={(e) => setManualNoc(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && manualNocValid) processInput(file, jobTitle, duties, manualNoc); }}
                        placeholder="e.g. 21300"
                        style={{ flex: '1 1 120px', minWidth: 0, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }}
                      />
                      <button
                        className="btn btn-outline"
                        disabled={!manualNocValid || loading}
                        onClick={() => manualNocValid && processInput(file, jobTitle, duties, manualNoc)}
                        style={{ padding: '10px 18px', whiteSpace: 'nowrap', opacity: (manualNocValid && !loading) ? 1 : 0.5 }}
                      >
                        Re-evaluate →
                      </button>
                    </div>
                    {/* Live feedback: confirm the typed code resolves to a real NOC title (avoids typos) */}
                    {manualNoc.length === 5 && (
                      manualNocTitle ? (
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✅</span> NOC {manualNoc} — <strong>{manualNocTitle}</strong>
                        </div>
                      ) : (
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#DC2626' }}>
                          ⚠️ No NOC 2021 code matches "{manualNoc}". Check the number.
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* CEC Eligibility Info */}
                <div className={`highlight-box ${result.cec_eligible ? 'highlight-box-blue' : ''}`}>
                  {!result.cec_eligible ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ⚠️ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      Occupations in TEER 4 or 5 are generally <strong>NOT</strong> eligible for core Express Entry CRS points or the Canadian Experience Class.
                    </p>
                  ) : file && result.location_of_experience === 'canada' ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This occupation is eligible for the <strong>Canadian Experience Class (CEC)</strong> (Provided you have at least 1,560 hours of qualifying Canadian experience).
                    </p>
                  ) : file && result.location_of_experience === 'outside_canada' ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This foreign experience doesn't count for CEC, but 1-3+ years of verifiable foreign work in TEER 0-3 can <strong>significantly increase your CRS score.</strong>
                    </p>
                  ) : (
                    <div style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      <p style={{ margin: '0 0 8px 0' }}>
                        ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                        This skilled occupation is highly valuable for Express Entry.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li><strong>If inside Canada:</strong> Counts toward CEC eligibility.</li>
                        <li><strong>If outside Canada:</strong> Can significantly increase your CRS score.</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* (Removed the "preliminary suggestion / full audit recommended" note — the duty-by-duty
                    breakdown above + the Auditor cross-sell below already cover this.) */}

                {/* Cross-sell CTA to Auditor */}
                <div style={{ 
                  marginTop: '24px', 
                  padding: '28px', 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                  borderRadius: '14px',
                  border: '1px solid #F59E0B'
                }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: '#92400E' }}>
                    Your NOC is {result.noc_code}. But does your employment letter actually prove it?
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: '#78350F', marginBottom: '16px', lineHeight: 1.5 }}>
                    {result.next_step || 'Run a full Employment Letter Audit to confirm eligibility and reduce refusal risk.'}
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={goToAuditor} style={{ background: '#D97706', borderColor: '#D97706' }}>
                    📄 Audit My Letter →
                  </button>
                  <p style={{ fontSize: '0.75rem', color: '#92400E', marginTop: '10px', marginBottom: 0 }}>Available individually ($24.90) or included in Optimize ($49)</p>
                </div>
                </div>{/* end anon blur wrapper */}

                {/* (Anonymous sign-in gate is rendered inline directly under the gauge — see above.) */}
              </div>
              );
            })()}

            {/* Bottom CTA — only shown when no result yet */}
            {!result && !loading && (
              <div style={{ 
                marginTop: '48px', 
                padding: '36px 28px', 
                textAlign: 'center',
                background: 'linear-gradient(135deg, #0F172A, #1E3A8A)',
                borderRadius: '16px',
                color: 'white'
              }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'white' }}>Don't Risk Your PR Application — Get Your NOC Right</h3>
                <p style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '24px', lineHeight: 1.6 }}>
                  A wrong NOC code can cost you your filing fee and months of waiting. Your duties determine your NOC — not your job title. Find the right one now.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-lg" 
                    onClick={() => document.getElementById('noc-input')?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ background: 'white', color: '#1E3A8A', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Find My NOC Now
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '16px', marginBottom: 0 }}>
                  Sign in to start — your first 2 full NOC reports are free.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
