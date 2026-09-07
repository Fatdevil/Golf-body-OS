/**
 * Golf Body OS — App Entry Point
 *
 * Currently mounting DV-1A (Native Truth Validation) screen.
 * This will be replaced with proper navigation once DV-1A passes.
 */
import React from 'react';
import DV1AValidationScreen from './src/validation/DV1AValidationScreen';

export default function App() {
  return <DV1AValidationScreen />;
}
