/**
 * Golf Body OS — Main Application Entry Point
 *
 * Mounts the ScreeningProvider and AppShell with complete
 * navigation (Dashboard, Screening Runner, History) and DV-1A diagnostics.
 */
import React from 'react';
import { ScreeningProvider } from './src/context/ScreeningContext';
import AppShell from './src/navigation/AppShell';

export default function App() {
  return (
    <ScreeningProvider>
      <AppShell />
    </ScreeningProvider>
  );
}

