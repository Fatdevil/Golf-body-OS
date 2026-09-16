/**
 * Priority Calculator — Determines training priorities from body profile.
 *
 * PURE FUNCTION — no side effects, no API calls, no randomness.
 * Same input → same output. Always.
 *
 * Algorithm:
 * 1. Extract base priority from each area's score (lower score = higher priority)
 * 2. Apply state modifiers (STIFF → boost mobility, TIRED → reduce strength)
 * 3. Apply context modifiers (COMPETITION → boost recovery)
 * 4. Boost asymmetries
 * 5. Sort descending by priority
 *
 * @module priority-calculator
 */

import type { BodyDomain } from '../types/shared-enums';
import type { BodyProfile, DomainAssessment, AreaScore } from '../types/body-profile';
import type { DailyState } from '../types/daily-state';
import type { GolfContext } from '../types/golf-context';

// ---------------------------------------------------------------------------
// Training Priority
// ---------------------------------------------------------------------------

/** A single training priority with its rationale */
export interface TrainingPriority {
  /** Which area needs training, e.g. 'hipRotation', 'singleLegBalance' */
  areaId: string;
  /** Which domain this area belongs to */
  domain: BodyDomain;
  /** Priority score (0.0 = not needed, 1.0 = critical) */
  priority: number;
  /** Why this area is prioritized */
  reason: { sv: string; en: string };
}

// ---------------------------------------------------------------------------
// State modifiers
// ---------------------------------------------------------------------------

interface DomainMultipliers {
  MOBILITY: number;
  MOTOR_CONTROL: number;
  LOAD_TOLERANCE: number;
}

function getStateModifiers(state: DailyState): DomainMultipliers {
  switch (state.bodyFeel) {
    case 'FRESH':
      return { MOBILITY: 1.0, MOTOR_CONTROL: 1.0, LOAD_TOLERANCE: 1.1 };
    case 'NORMAL':
      return { MOBILITY: 1.0, MOTOR_CONTROL: 1.0, LOAD_TOLERANCE: 1.0 };
    case 'STIFF':
      return { MOBILITY: 1.3, MOTOR_CONTROL: 0.9, LOAD_TOLERANCE: 0.7 };
    case 'TIRED':
      return { MOBILITY: 1.1, MOTOR_CONTROL: 0.8, LOAD_TOLERANCE: 0.5 };
    case 'SORE':
      return { MOBILITY: 1.2, MOTOR_CONTROL: 0.7, LOAD_TOLERANCE: 0.4 };
  }
}

function getContextModifiers(context: GolfContext): DomainMultipliers {
  // Competition today or tomorrow → shift toward recovery/mobility
  if (context.golfToday === 'COMPETITION' || context.golfTomorrow === 'COMPETITION') {
    return { MOBILITY: 1.2, MOTOR_CONTROL: 0.9, LOAD_TOLERANCE: 0.3 };
  }
  // Playing 18 today → warm-up focus
  if (context.golfToday === 'EIGHTEEN_HOLES' || context.golfToday === 'NINE_HOLES') {
    return { MOBILITY: 1.3, MOTOR_CONTROL: 0.8, LOAD_TOLERANCE: 0.4 };
  }
  // Playing tomorrow → moderate reduction in load
  if (context.golfTomorrow === 'EIGHTEEN_HOLES' || context.golfTomorrow === 'NINE_HOLES') {
    return { MOBILITY: 1.1, MOTOR_CONTROL: 1.0, LOAD_TOLERANCE: 0.7 };
  }
  // No golf → train normally
  return { MOBILITY: 1.0, MOTOR_CONTROL: 1.0, LOAD_TOLERANCE: 1.0 };
}

// ---------------------------------------------------------------------------
// Score → Priority conversion
// ---------------------------------------------------------------------------

/**
 * Convert a normalized score (0-100) to a base priority (0-1).
 * Lower scores produce higher priorities.
 * Uses a sigmoid-like curve so very low scores get disproportionately high priority.
 */
function scoreToPriority(score: number, maxScore: number): number {
  const normalized = maxScore > 0 ? score / maxScore : 0;
  // Invert: 0% score → 1.0 priority, 100% score → 0.05 priority
  // Curve: steeper drop-off at the "good" end
  const raw = 1.0 - Math.pow(normalized, 0.6);
  return Math.max(0.05, Math.min(1.0, raw));
}

// ---------------------------------------------------------------------------
// Area priority extraction
// ---------------------------------------------------------------------------

function extractAreaPriorities(
  domain: DomainAssessment,
  stateMultiplier: number,
  contextMultiplier: number,
): TrainingPriority[] {
  return domain.areas.map(area => {
    const basePriority = scoreToPriority(area.score, area.maxScore);

    // Apply multipliers
    let adjusted = basePriority * stateMultiplier * contextMultiplier;

    // Confidence penalty: if we haven't tested recently, lower priority
    if (domain.confidence === 'LOW') {
      adjusted *= 0.7;
    } else if (domain.confidence === 'MODERATE') {
      adjusted *= 0.85;
    }

    // Asymmetry boost: if compensations mention asymmetry
    if (area.compensations.some(c => c.toLowerCase().includes('asymmetry') || c.toLowerCase().includes('asymmetri'))) {
      adjusted *= 1.2;
    }

    // Clamp to [0, 1]
    const priority = Math.max(0, Math.min(1.0, adjusted));

    // Generate reason
    const qualityLabel = area.quality;
    const reason = generateReason(area, domain.domain, qualityLabel);

    return {
      areaId: area.areaId,
      domain: domain.domain,
      priority: Math.round(priority * 100) / 100,
      reason,
    };
  });
}

function generateReason(
  area: AreaScore,
  domain: BodyDomain,
  quality: string,
): { sv: string; en: string } {
  const pct = area.maxScore > 0 ? Math.round((area.score / area.maxScore) * 100) : 0;
  const label = area.label;

  if (quality === 'POOR') {
    return {
      sv: `${label.sv} visar en tydlig begränsning (${pct}%) — hög prioritet`,
      en: `${label.en} shows a clear limitation (${pct}%) — high priority`,
    };
  }
  if (quality === 'FAIR') {
    return {
      sv: `${label.sv} har utrymme för förbättring (${pct}%)`,
      en: `${label.en} has room for improvement (${pct}%)`,
    };
  }
  if (quality === 'GOOD') {
    return {
      sv: `${label.sv} är bra (${pct}%) — underhållsprioritet`,
      en: `${label.en} is good (${pct}%) — maintenance priority`,
    };
  }
  return {
    sv: `${label.sv} är utmärkt (${pct}%) — låg prioritet`,
    en: `${label.en} is excellent (${pct}%) — low priority`,
  };
}

// ---------------------------------------------------------------------------
// Pain-driven priority adjustments
// ---------------------------------------------------------------------------

function applyPainAdjustments(
  priorities: TrainingPriority[],
  state: DailyState,
): TrainingPriority[] {
  if (state.painAreas.length === 0) return priorities;

  // If SIGNIFICANT pain exists, drastically reduce all load tolerance
  const hasSignificantPain = state.painAreas.some(p => p.intensity === 'SIGNIFICANT');

  return priorities.map(p => {
    if (hasSignificantPain && p.domain === 'LOAD_TOLERANCE') {
      return { ...p, priority: Math.min(p.priority, 0.1) };
    }
    if (hasSignificantPain && p.domain === 'MOTOR_CONTROL') {
      return { ...p, priority: Math.min(p.priority, 0.3) };
    }
    return p;
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculates training priorities from body profile, daily state, and context.
 *
 * PURE FUNCTION — same input → same output.
 */
export function calculatePriorities(
  profile: BodyProfile,
  state: DailyState,
  context: GolfContext,
): TrainingPriority[] {
  const stateMods = getStateModifiers(state);
  const contextMods = getContextModifiers(context);

  const allPriorities: TrainingPriority[] = [
    ...extractAreaPriorities(
      profile.mobility,
      stateMods.MOBILITY,
      contextMods.MOBILITY,
    ),
    ...extractAreaPriorities(
      profile.motorControl,
      stateMods.MOTOR_CONTROL,
      contextMods.MOTOR_CONTROL,
    ),
    ...extractAreaPriorities(
      profile.loadTolerance,
      stateMods.LOAD_TOLERANCE,
      contextMods.LOAD_TOLERANCE,
    ),
  ];

  // Apply pain adjustments
  const adjusted = applyPainAdjustments(allPriorities, state);

  // Sort by priority descending
  return adjusted.sort((a, b) => b.priority - a.priority);
}
