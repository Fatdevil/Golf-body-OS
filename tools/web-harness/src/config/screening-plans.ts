/**
 * Screening Plans — Data-driven test configurations.
 *
 * To add a new test to the screening flow:
 * 1. Create a protocol file in src/protocols/
 * 2. Create a metrics file in src/core/metrics/
 * 3. Create a coaching engine in src/core/coaching/
 * 4. Add a step object to FULL_SCREENING.steps below
 * 5. Register the engine type in ScreeningFlowScreen
 *
 * That's it — the UI handles everything else automatically.
 *
 * @module screening-plans
 */

import { ScreeningPlan } from '../types/screening';

export const FULL_SCREENING: ScreeningPlan = {
  estimatedMinutes: 3,
  label: { sv: 'Hel Screening', en: 'Full Screening' },
  steps: [
    {
      id: 'HIP_HINGE',
      label: { sv: 'Höftfällning', en: 'Hip Hinge' },
      icon: '🏋️',
      color: 'blue',
      requiredView: 'SIDE',
      engineType: 'hinge',
      description: {
        sv: 'Sidovy — Mäter höftmobilitet, knävinkel och rygghållning genom 3 fällningar',
        en: 'Side view — Measures hip mobility, knee angle and posture through 3 reps',
      },
    },
    {
      id: 'THORACIC_ROTATION',
      label: { sv: 'Bröstryggsrotation', en: 'Thoracic Rotation' },
      icon: '🔄',
      color: 'purple',
      requiredView: 'FRONT',
      engineType: 'rotation',
      description: {
        sv: 'Framifrån — Mäter bröstryggsrotation, bäckenstabilitet och symmetri',
        en: 'Front view — Measures thoracic rotation, pelvic stability and symmetry',
      },
    },
    // ─────────────────────────────────────────────────
    // Future tests — uncomment when implemented:
    // ─────────────────────────────────────────────────
    // {
    //   id: 'SHOULDER_MOBILITY',
    //   label: { sv: 'Axelmobilitet', en: 'Shoulder Mobility' },
    //   icon: '💪',
    //   color: 'teal',
    //   requiredView: 'FRONT',
    //   engineType: 'shoulder',
    //   description: {
    //     sv: 'Framifrån — Mäter axelrotation och overhead mobilitet',
    //     en: 'Front view — Measures shoulder rotation and overhead mobility',
    //   },
    // },
    // {
    //   id: 'SINGLE_LEG_BALANCE',
    //   label: { sv: 'Enbensstabilitet', en: 'Single-Leg Balance' },
    //   icon: '🦩',
    //   color: 'amber',
    //   requiredView: 'FRONT',
    //   engineType: 'balance',
    //   description: {
    //     sv: 'Framifrån — Mäter balans och stabilitet på ett ben',
    //     en: 'Front view — Measures balance and stability on one leg',
    //   },
    // },
  ],
};
