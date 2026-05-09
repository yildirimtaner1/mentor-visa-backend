/**
 * Journey Progress Bar — shows users where they are in their PR journey.
 * Displayed on all journey tool pages (Eligibility, NOC, CRS, Documents).
 * 
 * Reads journey state from Zustand and highlights the current step.
 * Completed steps are clickable, leading users forward through the funnel.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useJourneyStore } from '../../stores/journeyStore';
import './JourneyProgressBar.css';

interface JourneyStep {
  id: string;
  label: string;
  shortLabel: string;
  path: string;
  icon: string;
  isComplete: (state: ReturnType<typeof useJourneyStore.getState>) => boolean;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'eligibility',
    label: 'Check Eligibility',
    shortLabel: 'Eligibility',
    path: '/get-started',
    icon: '🚀',
    isComplete: (s) => s.eligibility.completedAt !== null,
  },
  {
    id: 'noc',
    label: 'Find NOC Code',
    shortLabel: 'NOC Code',
    path: '/find-my-noc',
    icon: '🎯',
    isComplete: (s) => s.noc.code !== null,
  },
  {
    id: 'crs',
    label: 'Calculate CRS',
    shortLabel: 'CRS Score',
    path: '/crs-calculator',
    icon: '📊',
    isComplete: (s) => s.crs.score !== null,
  },
  {
    id: 'documents',
    label: 'Check Documents',
    shortLabel: 'Documents',
    path: '/documents',
    icon: '📋',
    isComplete: (s) => s.documents.length > 0 && s.documents.some(d => d.status !== 'not_started'),
  },
];

export function JourneyProgressBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useJourneyStore();

  const currentPath = location.pathname;
  const currentStepIndex = JOURNEY_STEPS.findIndex(s => s.path === currentPath);

  return (
    <div className="journey-bar">
      <div className="journey-bar-inner">
        {JOURNEY_STEPS.map((step, idx) => {
          const isComplete = step.isComplete(store);
          const isCurrent = step.path === currentPath;
          const isPast = isComplete && !isCurrent;
          const isFuture = !isComplete && !isCurrent;

          return (
            <div key={step.id} className="journey-bar-step-wrapper">
              {idx > 0 && (
                <div className={`journey-bar-connector ${isPast || isCurrent ? 'active' : ''}`} />
              )}
              <button
                className={`journey-bar-step ${isCurrent ? 'current' : ''} ${isPast ? 'complete' : ''} ${isFuture ? 'future' : ''}`}
                onClick={() => {
                  if (!isCurrent) navigate(step.path);
                }}
                title={step.label}
              >
                <span className="journey-bar-icon">
                  {isPast ? '✓' : step.icon}
                </span>
                <span className="journey-bar-label">{step.shortLabel}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Next step nudge */}
      {currentStepIndex >= 0 && currentStepIndex < JOURNEY_STEPS.length - 1 && (
        <NextStepNudge
          nextStep={JOURNEY_STEPS[currentStepIndex + 1]}
          currentComplete={JOURNEY_STEPS[currentStepIndex].isComplete(store)}
        />
      )}
    </div>
  );
}


function NextStepNudge({
  nextStep,
  currentComplete,
}: {
  nextStep: JourneyStep;
  currentComplete: boolean;
}) {
  const navigate = useNavigate();

  if (!currentComplete) return null;

  return (
    <div className="journey-nudge">
      <span className="journey-nudge-text">
        ✓ Step complete! Next:
      </span>
      <button
        className="journey-nudge-btn"
        onClick={() => navigate(nextStep.path)}
      >
        {nextStep.icon} {nextStep.label} →
      </button>
    </div>
  );
}
