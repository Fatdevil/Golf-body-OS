/**
 * Golf Swing Types & Schema Definition
 *
 * Defines the canonical 10 P-positions (P1 through P10),
 * camera view angles (Face-On, Down-The-Line), kinematics,
 * swing faults, tempo, and body-to-swing correlations.
 *
 * @module golf-swing
 * @version GOLF_SWING_TYPES_V1
 */

export const VERSION = 'GOLF_SWING_TYPES_V1';

export type CameraViewAngle = 'FACE_ON' | 'DOWN_THE_LINE';

/**
 * The canonical 10 P-Positions in modern golf biomechanics.
 */
export type SwingPhaseId =
  | 'P1_ADDRESS'
  | 'P2_TAKEAWAY'
  | 'P3_HALFWAY_BACK'
  | 'P4_TOP'
  | 'P5_SHALLOW'
  | 'P6_DELIVERY'
  | 'P7_IMPACT'
  | 'P8_RELEASE'
  | 'P9_REHINGE'
  | 'P10_FINISH';

export const ORDERED_SWING_PHASES: SwingPhaseId[] = [
  'P1_ADDRESS',
  'P2_TAKEAWAY',
  'P3_HALFWAY_BACK',
  'P4_TOP',
  'P5_SHALLOW',
  'P6_DELIVERY',
  'P7_IMPACT',
  'P8_RELEASE',
  'P9_REHINGE',
  'P10_FINISH'
];

export interface PhaseInfo {
  id: SwingPhaseId;
  shortLabel: string;
  name: { 'sv-SE': string; 'en-US': string };
  description: { 'sv-SE': string; 'en-US': string };
  checkpoint: { 'sv-SE': string; 'en-US': string };
}

export const SWING_PHASE_INFO: Record<SwingPhaseId, PhaseInfo> = {
  P1_ADDRESS: {
    id: 'P1_ADDRESS',
    shortLabel: 'P1',
    name: { 'sv-SE': 'Uppställning (Address)', 'en-US': 'Address (Setup)' },
    description: { 'sv-SE': 'Kroppshållning och balans före rörelsestart.', 'en-US': 'Static posture and balance before movement start.' },
    checkpoint: { 'sv-SE': 'Neutral ryggradsvinkel (35–45°) och lätt böjda knän.', 'en-US': 'Neutral spine angle (35–45°) and soft knee flex.' }
  },
  P2_TAKEAWAY: {
    id: 'P2_TAKEAWAY',
    shortLabel: 'P2',
    name: { 'sv-SE': 'Skaftet parallellt (Takeaway)', 'en-US': 'Shaft Parallel (Takeaway)' },
    description: { 'sv-SE': 'Klubban når horisontellt läge i baksvingen.', 'en-US': 'Club shaft parallel to the ground in backswing.' },
    checkpoint: { 'sv-SE': 'Bred rörelse utan handledsfladder eller lateral höftsvaj.', 'en-US': 'Wide takeaway without early wrist rolling or hip sway.' }
  },
  P3_HALFWAY_BACK: {
    id: 'P3_HALFWAY_BACK',
    shortLabel: 'P3',
    name: { 'sv-SE': 'Armen parallell (Halvvägs upp)', 'en-US': 'Lead Arm Parallel' },
    description: { 'sv-SE': 'Främre armen horisontell mot marken.', 'en-US': 'Lead arm parallel to ground.' },
    checkpoint: { 'sv-SE': '90° vinkel i handleden (hinge) och bröstkorgen roterar.', 'en-US': '90° wrist hinge set and thoracic rotation loading.' }
  },
  P4_TOP: {
    id: 'P4_TOP',
    shortLabel: 'P4',
    name: { 'sv-SE': 'Toppen av baksvingen (Top)', 'en-US': 'Top of Backswing' },
    description: { 'sv-SE': 'Maximal uppvridning där händerna vänder riktning.', 'en-US': 'Peak backswing turn where hand velocity reverses.' },
    checkpoint: { 'sv-SE': 'Maximal separation (X-Factor) mellan axlar och bäcken.', 'en-US': 'Maximal separation (X-Factor) between shoulders and pelvis.' }
  },
  P5_SHALLOW: {
    id: 'P5_SHALLOW',
    shortLabel: 'P5',
    name: { 'sv-SE': 'Övergång (Shallowing)', 'en-US': 'Lead Arm Parallel (Downswing)' },
    description: { 'sv-SE': 'Nedsvingen startar med bäckenet medan armarna planar ut.', 'en-US': 'Downswing initiates from pelvis while arms shallow.' },
    checkpoint: { 'sv-SE': 'Bäckenet roterar och flyttar vikt mot målet.', 'en-US': 'Pelvis opens and shifts ground pressure toward target.' }
  },
  P6_DELIVERY: {
    id: 'P6_DELIVERY',
    shortLabel: 'P6',
    name: { 'sv-SE': 'Leveransposition (Delivery)', 'en-US': 'Delivery (Shaft Parallel)' },
    description: { 'sv-SE': 'Klubbskaftet återigen parallellt med marken före träff.', 'en-US': 'Shaft parallel to ground in downswing right before impact.' },
    checkpoint: { 'sv-SE': 'Bibehållen handledsvinkel (lag) och öppna höfter.', 'en-US': 'Maintained wrist lag and opening hips.' }
  },
  P7_IMPACT: {
    id: 'P7_IMPACT',
    shortLabel: 'P7',
    name: { 'sv-SE': 'Träffögonblicket (Impact)', 'en-US': 'Impact' },
    description: { 'sv-SE': 'Bollträffen med maximal överföring av energi.', 'en-US': 'Ball contact point with maximal kinetic transfer.' },
    checkpoint: { 'sv-SE': 'Höfter öppna 35–45°, axlar öppna 15–25°, bibehållen ryggradsvinkel.', 'en-US': 'Hips open 35–45°, shoulders open 15–25°, spine angle maintained.' }
  },
  P8_RELEASE: {
    id: 'P8_RELEASE',
    shortLabel: 'P8',
    name: { 'sv-SE': 'Frisättning (Release)', 'en-US': 'Shaft Parallel (Follow-Through)' },
    description: { 'sv-SE': 'Klubbskaftet parallellt med marken efter träffen.', 'en-US': 'Club shaft parallel to ground after impact.' },
    checkpoint: { 'sv-SE': 'Full sträckning i båda armarna (ingen chicken wing).', 'en-US': 'Full extension in both arms without chicken-winging.' }
  },
  P9_REHINGE: {
    id: 'P9_REHINGE',
    shortLabel: 'P9',
    name: { 'sv-SE': 'Genomsving (Re-hinge)', 'en-US': 'Trail Arm Parallel' },
    description: { 'sv-SE': 'Bakre armen horisontell när kroppen vrids upp mot målet.', 'en-US': 'Trail arm parallel to ground rotating toward target.' },
    checkpoint: { 'sv-SE': 'Bröstkorgen roterar fritt genom bollen.', 'en-US': 'Thorax rotating freely through the target line.' }
  },
  P10_FINISH: {
    id: 'P10_FINISH',
    shortLabel: 'P10',
    name: { 'sv-SE': 'Avslutning (Finish)', 'en-US': 'Full Finish' },
    description: { 'sv-SE': 'Balanserat avslut med kroppen mot målet.', 'en-US': 'Balanced follow-through facing the target.' },
    checkpoint: { 'sv-SE': '90%+ av vikten på främre hälen, bältesspännet pekar mot målet.', 'en-US': '90%+ weight on lead heel, belt buckle facing target.' }
  }
};

export interface SwingPhaseEvent {
  phaseId: SwingPhaseId;
  frameIndex: number;
  timestampMs: number;
  confidence: number;
}

export interface SwingKinematics {
  phaseId: SwingPhaseId;
  timestampMs: number;
  frameIndex: number;
  // Rotations (degrees)
  shoulderTurn: number;         // Relative to address target line (0°)
  pelvisTurn: number;           // Relative to address target line (0°)
  xFactor: number;              // shoulderTurn - pelvisTurn
  // Angles & Posture (degrees)
  spineInclination: number;     // Torso angle vs vertical (Face-On lateral tilt or DTL forward tilt)
  spineAngleDelta: number;      // Change relative to P1 address
  kneeFlex: number;             // Knee flexion angle
  leadArmAngle: number;         // Angle of lead arm vs horizontal
  leadElbowAngle: number;       // Angle of lead elbow (180° = straight)
  // Translations (normalized ratios relative to body height or stance)
  lateralHeadSway: number;      // Shift along target line from address (+ towards target, - away)
  lateralPelvisShift: number;   // Shift of pelvis center along target line
  pelvisThrust: number;         // Movement towards ball (Early Extension metric)
}

export type SwingFaultId =
  | 'EARLY_EXTENSION'
  | 'SWAY_BACKSWING'
  | 'SLIDE_DOWNSWING'
  | 'LOSS_OF_POSTURE'
  | 'REVERSE_SPINE'
  | 'CHICKEN_WING'
  | 'OVER_ROTATION_PELVIS'
  | 'CASTING_EARLY_RELEASE';

export interface SwingFault {
  id: SwingFaultId;
  name: { 'sv-SE': string; 'en-US': string };
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  phaseDetected: SwingPhaseId;
  metricValue: number;
  threshold: number;
  unit: string;
  description: { 'sv-SE': string; 'en-US': string };
  relatedBodyLimitation: { 'sv-SE': string; 'en-US': string };
}

export interface BodySwingCorrelation {
  bodyTest: 'HIP_HINGE' | 'THORACIC_ROTATION';
  bodyScore: number;
  relatedSwingFaultId: SwingFaultId;
  title: { 'sv-SE': string; 'en-US': string };
  explanation: { 'sv-SE': string; 'en-US': string };
  prescription: { 'sv-SE': string; 'en-US': string };
}

export interface SwingTempo {
  backswingDurationMs: number;
  downswingDurationMs: number;
  totalDurationMs: number;
  tempoRatio: number;          // e.g. 3.0 means 3.0:1 ratio (PGA Tour standard ~3.0:1)
  rating: 'EXCELLENT' | 'GOOD' | 'FAST_BACKSWING' | 'SLOW_BACKSWING';
}

export interface GolfSwingAnalysisResult {
  sessionId: string;
  viewAngle: CameraViewAngle;
  detectedFrameRate: number;    // e.g. 240, 120, 60, 30
  totalFramesAnalyzed: number;
  durationMs: number;
  phases: Record<SwingPhaseId, SwingPhaseEvent>;
  orderedEvents: SwingPhaseEvent[];
  kinematics: Record<SwingPhaseId, SwingKinematics>;
  tempo: SwingTempo;
  faults: SwingFault[];
  correlations: BodySwingCorrelation[];
  overallSwingScore: number;    // 0 - 100
}
