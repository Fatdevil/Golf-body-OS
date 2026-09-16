/**
 * Screening Type System — Generic, data-driven screening architecture.
 *
 * This module defines the types that allow N screening tests to be composed
 * into a single screening flow without any hardcoded step names.
 *
 * @module screening-types
 */

import { GolfBodyTier } from '../../../../src/core/metrics/golf-body-score';

// ---------------------------------------------------------------------------
// Screening Plan (input configuration)
// ---------------------------------------------------------------------------

/** A single test step in a screening plan */
export interface ScreeningTestStep {
  /** Unique ID, e.g. 'HIP_HINGE', 'THORACIC_ROTATION', 'SHOULDER_MOBILITY' */
  id: string;
  /** Human-readable labels per language */
  label: { sv: string; en: string };
  /** Emoji icon shown in stepper & results */
  icon: string;
  /** Tailwind color token for theming (e.g. 'blue', 'purple') */
  color: string;
  /** Camera perspective required for this test */
  requiredView: 'SIDE' | 'FRONT' | 'BACK';
  /** Which coaching engine type to use during live capture */
  engineType: 'hinge' | 'rotation';
  /** Short description shown during transition */
  description: { sv: string; en: string };
}

/** A full screening plan — an ordered list of test steps */
export interface ScreeningPlan {
  /** Ordered list of tests to run */
  steps: ScreeningTestStep[];
  /** Estimated total duration in minutes */
  estimatedMinutes: number;
  /** Plan label */
  label: { sv: string; en: string };
}

// ---------------------------------------------------------------------------
// Screening Results (output)
// ---------------------------------------------------------------------------

/** A single sub-metric within a test result */
export interface SubMetric {
  id: string;
  label: { sv: string; en: string };
  value: number;
  maxValue: number;
  unit?: string;
  /** Quality assessment */
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

/** Result from one completed test step */
export interface TestStepResult {
  /** Matches ScreeningTestStep.id */
  stepId: string;
  /** Score for this pillar (e.g. 0-50) */
  pillarScore: number;
  /** Maximum possible score for this pillar */
  maxScore: number;
  /** Human-readable labels */
  label: { sv: string; en: string };
  /** Icon from the step config */
  icon: string;
  /** Color from the step config */
  color: string;
  /** Breakdown of individual metrics */
  subMetrics: SubMetric[];
  /** Detected compensations (human-readable) */
  compensations: CompensationResult[];
  /** Key angle measurements for display */
  angles: AngleResult[];
}

/** A compensation detected during a test */
export interface CompensationResult {
  type: string;
  label: { sv: string; en: string };
  tip: { sv: string; en: string };
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** A key angle measurement */
export interface AngleResult {
  id: string;
  label: { sv: string; en: string };
  value: number;
  unit: string;
  optimal: string;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

/** Complete screening result across all tests */
export interface ScreeningResult {
  /** Total score 0-100 */
  totalScore: number;
  /** Performance tier */
  tier: GolfBodyTier;
  /** Tier label */
  tierLabel: string;
  /** Tier color hex */
  tierColor: string;
  /** Individual test results */
  stepResults: TestStepResult[];
  /** Identified strengths */
  keyStrengths: string[];
  /** Identified bottlenecks */
  primaryBottlenecks: string[];
  /** Summary text */
  summary: string;
}

// ---------------------------------------------------------------------------
// Flow State
// ---------------------------------------------------------------------------

/** Phase of the overall screening flow */
export type ScreeningPhase = 'CAMERA' | 'TRANSITION' | 'COMPLETE';

/** The runtime state of a screening flow */
export interface ScreeningFlowState {
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Current phase within the step */
  phase: ScreeningPhase;
  /** Results collected so far */
  completedResults: TestStepResult[];
  /** The full plan being executed */
  plan: ScreeningPlan;
}
