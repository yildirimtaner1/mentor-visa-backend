/**
 * useJourneySync Hook
 * 
 * Handles the lifecycle of syncing the journey store with the backend:
 * 1. On sign-in: fetch journey from backend → hydrate store
 * 2. On store change (dirty flag): debounce 2s → sync to backend
 * 3. On first load for existing users: migrate previous evaluations
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useJourneyStore } from '../stores/journeyStore';
import { getJourney, migrateJourney, syncJourneyToBackend } from '../services/journeyApi';

export function useJourneySync() {
  const { isSignedIn, getToken } = useAuth();
  const {
    _dirty,
    journeyId,
    hydrateFromBackend,
    markClean,
    currentPhase,
    eligibility,
    noc,
    crs,
    profile,
    profileUpdatedAt,
  } = useJourneyStore();

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedRef = useRef(false);

  // ── Fetch journey from backend on sign-in ──
  useEffect(() => {
    if (!isSignedIn || hasFetchedRef.current) return;

    const fetchAndHydrate = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // First, try to get existing journey
        const journeyData = await getJourney(token);
        
        // If journey has no NOC code, try migrating from existing evaluations
        if (!journeyData.noc_code && !journeyData.crs_score) {
          const migrationResult = await migrateJourney(token);
          hydrateFromBackend(migrationResult.journey);
        } else {
          hydrateFromBackend(journeyData);
        }

        hasFetchedRef.current = true;
      } catch (error) {
        console.error('Failed to fetch journey:', error);
        hasFetchedRef.current = true; // Don't retry forever
      }
    };

    fetchAndHydrate();
  }, [isSignedIn, getToken, hydrateFromBackend]);

  // Reset fetch flag on sign-out
  useEffect(() => {
    if (!isSignedIn) {
      hasFetchedRef.current = false;
    }
  }, [isSignedIn]);

  // ── Debounced sync to backend when store changes ──
  const syncToBackend = useCallback(async () => {
    if (!isSignedIn) return;
    
    try {
      const token = await getToken();
      if (!token) return;

      const state = useJourneyStore.getState();
      await syncJourneyToBackend(token, state);
      markClean();
    } catch (error) {
      console.error('Failed to sync journey to backend:', error);
    }
  }, [isSignedIn, getToken, markClean]);

  useEffect(() => {
    if (!_dirty || !isSignedIn) return;

    // Clear any existing timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    // Debounce: sync after 2 seconds of no changes
    syncTimerRef.current = setTimeout(syncToBackend, 2000);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [_dirty, isSignedIn, syncToBackend, currentPhase, eligibility, noc, crs, profile, profileUpdatedAt]);

  return { isSignedIn, journeyId };
}
