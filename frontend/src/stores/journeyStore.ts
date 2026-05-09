/**
 * PR Journey Zustand Store
 * 
 * Central state management for the Canada PR journey.
 * Data flows between all tools (NOC Finder → Eligibility → Documents → CRS).
 * 
 * - Guests: persisted in localStorage
 * - Signed-in users: synced to backend (debounced 2s)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ──

export interface LanguageScores {
  test: string; // "ielts_general", "celpip", "tef", "tcf"
  speaking: number;
  listening: number;
  reading: number;
  writing: number;
}

export interface CountryStay {
  country: string;
  months: number;
}

export interface DocumentItemState {
  id?: number;
  document_type: string;
  label: string;
  status: 'not_started' | 'in_progress' | 'obtained';
  expiry_date: string | null;
  notes: string | null;
}

export interface EligibilityState {
  completedAt: string | null;
  fswpEligible: boolean | null;
  cecEligible: boolean | null;
  fstpEligible: boolean | null;
  fswpScore: number | null;
  recommendedProgram: string | null;
}

export interface NOCState {
  code: string | null;
  title: string | null;
  teerCategory: string | null;
  cecEligible: boolean | null;
  confidence: number | null;
}

export interface CRSState {
  score: number | null;
  calculatedAt: string | null;
  categoryDrawEligible: string[];
  inputs: any | null;
}

export interface ProfileState {
  age: number | null;
  countryOfCitizenship: string | null;
  countryOfResidence: string | null;
  educationLevel: string | null;
  educationInCanada: boolean | null;
  hasEca: boolean | null;
  primaryLanguage: LanguageScores | null;
  secondaryLanguage: LanguageScores | null;
  totalSkilledExperienceYears: number | null;
  canadianExperienceYears: number | null;
  primaryOccupation: string | null;
  hasJobOffer: boolean | null;
  hasProvincialNomination: boolean | null;
  maritalStatus: string | null;
  spouseAccompanying: boolean | null;
  spouseEducationLevel: string | null;
  spouseLanguage: LanguageScores | null;
  spouseCanadianExperienceYears: number | null;
  hasRelativeInCanada: boolean | null;
  canadianExperienceRecent: boolean | null; // within last 3 years (CEC requirement)
  countriesLivedIn: CountryStay[];
}

export interface PRJourneyState {
  // Backend metadata
  journeyId: number | null;
  userId: string | null;
  
  // Journey progress
  currentPhase: number;
  
  // Sub-states
  eligibility: EligibilityState;
  noc: NOCState;
  crs: CRSState;
  profile: ProfileState;
  documents: DocumentItemState[];
  
  // Subscription
  tier: 'free' | 'starter' | 'complete';
  
  // Profile edit tracking (for CRS staleness detection)
  profileUpdatedAt: string | null;
  
  // Sync status
  _lastSyncedAt: string | null;
  _dirty: boolean;
}

interface PRJourneyActions {
  // Setters
  setNoc: (noc: Partial<NOCState>) => void;
  setEligibility: (eligibility: Partial<EligibilityState>) => void;
  setCRS: (crs: Partial<CRSState>) => void;
  setProfile: (profile: Partial<ProfileState>) => void;
  setProfileSilent: (profile: Partial<ProfileState>) => void; // Update profile without marking as user-edited
  setTier: (tier: 'free' | 'starter' | 'complete') => void;
  setPhase: (phase: number) => void;
  updateDocument: (docType: string, update: Partial<DocumentItemState>) => void;
  setDocuments: (docs: DocumentItemState[]) => void;
  
  // Hydration from backend
  hydrateFromBackend: (data: any) => void;
  
  // Reset
  resetJourney: () => void;
  
  // Sync flag
  markClean: () => void;
}

const initialState: PRJourneyState = {
  journeyId: null,
  userId: null,
  currentPhase: 1,
  eligibility: {
    completedAt: null,
    fswpEligible: null,
    cecEligible: null,
    fstpEligible: null,
    fswpScore: null,
    recommendedProgram: null,
  },
  noc: {
    code: null,
    title: null,
    teerCategory: null,
    cecEligible: null,
    confidence: null,
  },
  crs: {
    score: null,
    calculatedAt: null,
    categoryDrawEligible: [],
    inputs: null,
  },
  profile: {
    age: null,
    countryOfCitizenship: null,
    countryOfResidence: null,
    educationLevel: null,
    educationInCanada: null,
    hasEca: null,
    primaryLanguage: null,
    secondaryLanguage: null,
    totalSkilledExperienceYears: null,
    canadianExperienceYears: null,
    primaryOccupation: null,
    hasJobOffer: null,
    hasProvincialNomination: null,
    maritalStatus: null,
    spouseAccompanying: null,
    spouseEducationLevel: null,
    spouseLanguage: null,
    spouseCanadianExperienceYears: null,
    hasRelativeInCanada: null,
    canadianExperienceRecent: null,
    countriesLivedIn: [],
  },
  documents: [],
  tier: 'free',
  profileUpdatedAt: null,
  _lastSyncedAt: null,
  _dirty: false,
};

export const useJourneyStore = create<PRJourneyState & PRJourneyActions>()(
  persist(
    (set) => ({
      ...initialState,

      setNoc: (noc) =>
        set((state) => ({
          noc: { ...state.noc, ...noc },
          _dirty: true,
        })),

      setEligibility: (eligibility) =>
        set((state) => ({
          eligibility: { ...state.eligibility, ...eligibility },
          _dirty: true,
        })),

      setCRS: (crs) =>
        set((state) => ({
          crs: { ...state.crs, ...crs },
          _dirty: true,
        })),

      setProfile: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
          profileUpdatedAt: new Date().toISOString(),
          _dirty: true,
        })),

      // Silent profile update: used by CRS Calculator / Eligibility Wizard
      // when they write profile data as a side-effect of their own flow.
      // Does NOT set profileUpdatedAt, so it won't trigger CRS stale warnings.
      setProfileSilent: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
          _dirty: true,
        })),

      setTier: (tier) =>
        set(() => ({
          tier,
          _dirty: true,
        })),

      setPhase: (phase) =>
        set(() => ({
          currentPhase: phase,
          _dirty: true,
        })),

      updateDocument: (docType, update) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.document_type === docType ? { ...doc, ...update } : doc
          ),
          _dirty: true,
        })),

      setDocuments: (docs) =>
        set(() => ({
          documents: docs,
          _dirty: true,
        })),

      hydrateFromBackend: (data: any) =>
        set((state) => ({
          journeyId: data.id ?? null,
          userId: data.user_id ?? null,
          currentPhase: data.current_phase ?? 1,
          eligibility: {
            completedAt: null,
            fswpEligible: data.eligible_programs?.fswp ?? null,
            cecEligible: data.eligible_programs?.cec ?? null,
            fstpEligible: data.eligible_programs?.fstp ?? null,
            fswpScore: data.fswp_score ?? null,
            recommendedProgram: data.recommended_program ?? null,
          },
          noc: {
            code: data.noc_code ?? null,
            title: data.noc_title ?? null,
            teerCategory: data.teer_category ?? null,
            cecEligible: data.noc_cec_eligible ?? null,
            confidence: null,
          },
          crs: {
            score: data.crs_score ?? null,
            // Prefer local calculatedAt if score hasn't changed (avoid sync overwrite)
            calculatedAt: (data.crs_score != null && data.crs_score === state.crs.score)
              ? (state.crs.calculatedAt ?? data.crs_calculated_at ?? null)
              : (data.crs_calculated_at ?? null),
            categoryDrawEligible: data.category_draw_eligible ?? [],
            inputs: state.crs.inputs ?? null,
          },
          profile: data.profile_data
            ? {
                age: data.profile_data.age ?? null,
                countryOfCitizenship: data.profile_data.country_of_citizenship ?? null,
                countryOfResidence: data.profile_data.country_of_residence ?? null,
                educationLevel: data.profile_data.education_level ?? null,
                educationInCanada: data.profile_data.education_in_canada ?? null,
                hasEca: data.profile_data.has_eca ?? null,
                primaryLanguage: data.profile_data.primary_language_test
                  ? {
                      test: data.profile_data.primary_language_test,
                      speaking: data.profile_data.primary_speaking ?? 0,
                      listening: data.profile_data.primary_listening ?? 0,
                      reading: data.profile_data.primary_reading ?? 0,
                      writing: data.profile_data.primary_writing ?? 0,
                    }
                  : null,
                secondaryLanguage: data.profile_data.secondary_language_test
                  ? {
                      test: data.profile_data.secondary_language_test,
                      speaking: data.profile_data.secondary_speaking ?? 0,
                      listening: data.profile_data.secondary_listening ?? 0,
                      reading: data.profile_data.secondary_reading ?? 0,
                      writing: data.profile_data.secondary_writing ?? 0,
                    }
                  : null,
                totalSkilledExperienceYears: data.profile_data.total_skilled_experience_years ?? null,
                canadianExperienceYears: data.profile_data.canadian_experience_years ?? null,
                primaryOccupation: data.profile_data.primary_occupation ?? null,
                hasJobOffer: data.profile_data.has_job_offer ?? null,
                hasProvincialNomination: data.profile_data.has_provincial_nomination ?? null,
                maritalStatus: data.profile_data.marital_status ?? null,
                hasRelativeInCanada: data.profile_data.has_relative_in_canada ?? null,
                canadianExperienceRecent: data.profile_data.canadian_experience_recent ?? null,
                spouseAccompanying: data.profile_data.spouse_accompanying ?? null,
                spouseEducationLevel: data.profile_data.spouse_education_level ?? null,
                spouseLanguage: data.profile_data.spouse_language_test
                  ? {
                      test: data.profile_data.spouse_language_test,
                      speaking: data.profile_data.spouse_speaking ?? 0,
                      listening: data.profile_data.spouse_listening ?? 0,
                      reading: data.profile_data.spouse_reading ?? 0,
                      writing: data.profile_data.spouse_writing ?? 0,
                    }
                  : null,
                spouseCanadianExperienceYears: data.profile_data.spouse_canadian_experience_years ?? null,
                countriesLivedIn: data.profile_data.countries_lived_in ?? [],
              }
            : initialState.profile,
          documents: (data.documents || []).map((d: any) => ({
            id: d.id,
            document_type: d.document_type,
            label: d.label || d.document_type,
            status: d.status || 'not_started',
            expiry_date: d.expiry_date || null,
            notes: d.notes || null,
          })),
          tier: (data.subscription_tier as 'free' | 'starter' | 'complete') || 'free',
          // Preserve profileUpdatedAt from local state — backend doesn't store this
          profileUpdatedAt: state.profileUpdatedAt,
          _lastSyncedAt: new Date().toISOString(),
          _dirty: false,
        })),

      resetJourney: () => set({ ...initialState }),

      markClean: () => set({ _dirty: false, _lastSyncedAt: new Date().toISOString() }),
    }),
    {
      name: 'mentor-visa-journey',
      // Only persist essential fields, not internal sync flags
      partialize: (state) => ({
        currentPhase: state.currentPhase,
        eligibility: state.eligibility,
        noc: state.noc,
        crs: state.crs,
        profile: state.profile,
        documents: state.documents,
        tier: state.tier,
        profileUpdatedAt: state.profileUpdatedAt,
      }),
    }
  )
);
