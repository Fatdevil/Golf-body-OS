/**
 * Screening Context — Global State for Golf Body OS
 *
 * Manages active navigation tab, screening execution state,
 * persisted history, and latest results.
 *
 * @module ScreeningContext
 * @version SCREENING_CONTEXT_V1
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  screeningRepository,
  StoredScreeningSession,
  ScreeningTestType
} from '../storage/screening-repository';
import { SupportedLanguage } from '../core/coaching/i18n/locales';

export type AppTab = 'DASHBOARD' | 'SCREENING' | 'HISTORY' | 'DIAGNOSTICS';

interface ScreeningContextValue {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;

  // History & Sessions
  sessions: StoredScreeningSession[];
  latestSession: StoredScreeningSession | null;
  isLoading: boolean;
  refreshSessions: () => Promise<void>;
  saveScreeningSession: (session: StoredScreeningSession) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Active screening workflow
  activeTestType: ScreeningTestType | null;
  setActiveTestType: (testType: ScreeningTestType | null) => void;
  activeScreeningStep: 'SELECT' | 'RUNNER' | 'RESULT';
  setActiveScreeningStep: (step: 'SELECT' | 'RUNNER' | 'RESULT') => void;
  currentResult: StoredScreeningSession | null;
  setCurrentResult: (result: StoredScreeningSession | null) => void;

  startScreening: (testType: ScreeningTestType) => void;
  finishScreening: (result: StoredScreeningSession) => Promise<void>;
  cancelScreening: () => void;
}

const ScreeningContext = createContext<ScreeningContextValue | null>(null);

export function ScreeningProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<AppTab>('DASHBOARD');
  const [language, setLanguage] = useState<SupportedLanguage>('sv-SE');
  const [sessions, setSessions] = useState<StoredScreeningSession[]>([]);
  const [latestSession, setLatestSession] = useState<StoredScreeningSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active screening state
  const [activeTestType, setActiveTestType] = useState<ScreeningTestType | null>(null);
  const [activeScreeningStep, setActiveScreeningStep] = useState<'SELECT' | 'RUNNER' | 'RESULT'>('SELECT');
  const [currentResult, setCurrentResult] = useState<StoredScreeningSession | null>(null);

  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await screeningRepository.getSessions();
      setSessions(all);
      setLatestSession(all.length > 0 ? all[0] : null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const saveScreeningSession = useCallback(async (session: StoredScreeningSession) => {
    await screeningRepository.saveSession(session);
    await refreshSessions();
  }, [refreshSessions]);

  const clearHistory = useCallback(async () => {
    await screeningRepository.clearHistory();
    await refreshSessions();
  }, [refreshSessions]);

  const startScreening = useCallback((testType: ScreeningTestType) => {
    setActiveTestType(testType);
    setCurrentResult(null);
    setActiveScreeningStep('RUNNER');
    setActiveTab('SCREENING');
  }, []);

  const finishScreening = useCallback(async (result: StoredScreeningSession) => {
    setCurrentResult(result);
    setActiveScreeningStep('RESULT');
    await saveScreeningSession(result);
  }, [saveScreeningSession]);

  const cancelScreening = useCallback(() => {
    setActiveTestType(null);
    setCurrentResult(null);
    setActiveScreeningStep('SELECT');
  }, []);

  const value: ScreeningContextValue = {
    activeTab,
    setActiveTab,
    language,
    setLanguage,
    sessions,
    latestSession,
    isLoading,
    refreshSessions,
    saveScreeningSession,
    clearHistory,
    activeTestType,
    setActiveTestType,
    activeScreeningStep,
    setActiveScreeningStep,
    currentResult,
    setCurrentResult,
    startScreening,
    finishScreening,
    cancelScreening
  };

  return (
    <ScreeningContext.Provider value={value}>
      {children}
    </ScreeningContext.Provider>
  );
}

export function useScreening(): ScreeningContextValue {
  const ctx = useContext(ScreeningContext);
  if (!ctx) {
    throw new Error('useScreening must be used within a ScreeningProvider');
  }
  return ctx;
}
