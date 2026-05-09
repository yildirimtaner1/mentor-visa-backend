/**
 * Journey API Service
 * 
 * Handles communication with the backend journey endpoints.
 * Used by the journey store sync logic and individual tool pages.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get the user's full journey state from the backend.
 */
export async function getJourney(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch journey state.');
  }
  return response.json();
}

/**
 * Partially update the user's journey state.
 * Only sends non-null fields.
 */
export async function updateJourney(token: string, data: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update journey state.');
  }
  return response.json();
}

/**
 * One-time migration: scans existing evaluations (NOC Finder, CRS Calculator)
 * and pre-populates the journey with any data found.
 */
export async function migrateJourney(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey/migrate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to migrate journey data.');
  }
  return response.json();
}

/**
 * Get the user's document checklist items.
 */
export async function getDocuments(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey/documents`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch documents.');
  }
  return response.json();
}

/**
 * Update a single document item (status, expiry, notes).
 */
export async function updateDocument(token: string, docId: number, data: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey/documents/${docId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update document.');
  }
  return response.json();
}

/**
 * Generate a personalized document checklist based on the user's profile.
 * Idempotent — won't duplicate documents that already exist.
 */
export async function generateDocumentChecklist(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/journey/documents/generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate document checklist.');
  }
  return response.json();
}

/**
 * Sync the journey store to the backend.
 * Converts frontend camelCase state to backend snake_case format.
 * Debounce this call in the UI (2 seconds recommended).
 */
export async function syncJourneyToBackend(token: string, state: any) {
  // Convert frontend state to backend format
  const backendData: Record<string, any> = {};

  if (state.currentPhase != null) backendData.current_phase = state.currentPhase;
  if (state.noc?.code) {
    backendData.noc_code = state.noc.code;
    backendData.noc_title = state.noc.title;
    backendData.teer_category = state.noc.teerCategory;
    backendData.noc_cec_eligible = state.noc.cecEligible;
  }
  if (state.crs?.score != null) {
    backendData.crs_score = state.crs.score;
    backendData.category_draw_eligible = state.crs.categoryDrawEligible;
  }
  if (state.eligibility?.fswpEligible != null) {
    backendData.eligible_programs = {
      fswp: state.eligibility.fswpEligible,
      cec: state.eligibility.cecEligible,
      fstp: state.eligibility.fstpEligible,
    };
    backendData.fswp_score = state.eligibility.fswpScore;
    backendData.recommended_program = state.eligibility.recommendedProgram;
  }
  if (state.profile) {
    backendData.profile_data = {
      age: state.profile.age,
      country_of_citizenship: state.profile.countryOfCitizenship,
      country_of_residence: state.profile.countryOfResidence,
      education_level: state.profile.educationLevel,
      education_in_canada: state.profile.educationInCanada,
      has_eca: state.profile.hasEca,
      primary_language_test: state.profile.primaryLanguage?.test,
      primary_speaking: state.profile.primaryLanguage?.speaking,
      primary_listening: state.profile.primaryLanguage?.listening,
      primary_reading: state.profile.primaryLanguage?.reading,
      primary_writing: state.profile.primaryLanguage?.writing,
      secondary_language_test: state.profile.secondaryLanguage?.test,
      secondary_speaking: state.profile.secondaryLanguage?.speaking,
      secondary_listening: state.profile.secondaryLanguage?.listening,
      secondary_reading: state.profile.secondaryLanguage?.reading,
      secondary_writing: state.profile.secondaryLanguage?.writing,
      total_skilled_experience_years: state.profile.totalSkilledExperienceYears,
      canadian_experience_years: state.profile.canadianExperienceYears,
      primary_occupation: state.profile.primaryOccupation,
      has_job_offer: state.profile.hasJobOffer,
      has_provincial_nomination: state.profile.hasProvincialNomination,
      marital_status: state.profile.maritalStatus,
      spouse_accompanying: state.profile.spouseAccompanying,
      spouse_education_level: state.profile.spouseEducationLevel,
      spouse_language_test: state.profile.spouseLanguage?.test,
      spouse_speaking: state.profile.spouseLanguage?.speaking,
      spouse_listening: state.profile.spouseLanguage?.listening,
      spouse_reading: state.profile.spouseLanguage?.reading,
      spouse_writing: state.profile.spouseLanguage?.writing,
      spouse_canadian_experience_years: state.profile.spouseCanadianExperienceYears,
      countries_lived_in: state.profile.countriesLivedIn,
    };
  }

  return updateJourney(token, backendData);
}
