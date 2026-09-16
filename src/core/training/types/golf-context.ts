/**
 * Golf Context — Situational data about what's happening today/tomorrow.
 *
 * This is the "C" in Capability + State + Context = Plan.
 * Changes based on the golfer's schedule and preferences.
 *
 * @module golf-context
 */

// ---------------------------------------------------------------------------
// Golf activity
// ---------------------------------------------------------------------------

/** What golf activity is planned */
export type GolfActivity =
  | 'NONE'
  | 'PRACTICE'
  | 'NINE_HOLES'
  | 'EIGHTEEN_HOLES'
  | 'COMPETITION';

// ---------------------------------------------------------------------------
// Focus mode
// ---------------------------------------------------------------------------

/**
 * User's preferred focus for today's training.
 *
 * AUTO = let the engine decide the optimal mix.
 * Other modes express a preference — the engine still controls the mix
 * to ensure a safe and rational training session.
 *
 * AUTO:           ~50% mobility, ~30% strength, ~20% control
 * MOBILITY:       ~70% mobility, ~15% strength, ~15% control
 * STRENGTH:       ~30% mobility, ~50% strength, ~20% control
 * RECOVERY:       ~60% recovery/mobility, ~30% control, ~10% light movement
 */
export type FocusMode = 'AUTO' | 'MOBILITY' | 'STRENGTH' | 'RECOVERY';

// ---------------------------------------------------------------------------
// Golf Context (the composite)
// ---------------------------------------------------------------------------

/** Situational context for today's training */
export interface GolfContext {
  /** Golf planned today */
  golfToday: GolfActivity;

  /** Golf planned tomorrow */
  golfTomorrow: GolfActivity;

  /** Available time for training (minutes) */
  timeBudget: 10 | 20 | 30;

  /** User's preferred focus (AUTO = let engine decide) */
  focusMode: FocusMode;
}
