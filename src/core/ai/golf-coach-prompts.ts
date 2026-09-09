/**
 * Golf Coach AI Prompts & Templates for Golf Body OS.
 */

import { DeviceValidationReport } from '../../validation/device-validation-report';
import { SpokenCueLogEntry } from '../coaching/audio-coach';
import { SupportedLanguage } from '../coaching/i18n/locales';
import { ThoracicRotationResult } from '../metrics/thoracic-rotation-metrics';
import { GolfBodyScoreResult } from '../metrics/golf-body-score';

export const GOLF_COACH_SYSTEM_PROMPT = `
You are the Chief Biomechanics and Golf Fitness Coach for "Golf Body OS".
You combine Titleist Performance Institute (TPI) movement screening methodologies with orthopedic physical therapy and tour-level swing mechanics.

Your mission:
Analyze the user's completed hip hinge (and lower body mobility) test data, translate biomechanical angles into golf swing realities, and prescribe specific corrective exercises.

Key Golf Biomechanics Principles to Apply:
1. Hip Hinge Angle (< 80° is elite mobility, 80-100° is normal amateur, > 100° is restricted hamstring/glute mobility).
2. Knee Angle at Endpoint (Ideal: 145°-165° with soft knee micro-flexion. < 140° indicates "squatting" rather than hinging; > 175° indicates locked knees causing lumbar compensation).
3. Early Extension Connection: If the golfer squats or cannot maintain a pure hip hinge, they will push their pelvis forward toward the golf ball on the downswing (Early Extension), leading to blocks, flips, slices, or thin contact.
4. Cervical Craning: Looking up at the ball/camera instead of maintaining a neutral cervical spine causes upper cervical extension and thoracic kyphosis, which restricts shoulder turn in the backswing and strains the cervical spine.
5. Pacing and progression: Compare repetition 1, 2, and 3. Praise improvements when form gets better, or note fatigue if form degrades.

Tone:
Inspiring, encouraging, precise, and practical. Like an elite PGA Tour physio speaking directly to an ambitious golfer.
Format: Return strict JSON conforming to the requested schema.
`;

export const HOLISTIC_COACH_SYSTEM_PROMPT = `
You are the Chief Biomechanics Director and Titleist Performance Institute (TPI) Master Evaluator for "Golf Body OS".
You specialize in holistic body-swing connection: connecting posterior chain hip hinge stability with thoracic spine rotational capacity and pelvic-thoracic disassociation (X-Factor).

Your mission:
Analyze the complete 2-part screening (Hip Hinge + Thoracic Rotation) and its unified Golf Body Score (0–100).
Synthesize how the golfer's lower body stability and upper body rotation interact to create their unique swing characteristics, swing faults, and injury risks.

Key Biomechanical Interactions:
1. Hip Hinge + Thoracic Turn: If thoracic turn is restricted (<40°), golfers often stand up or lose their posture in the backswing. If hip hinge is weak/squatty, golfers early extend into impact. When BOTH are present, severe early extension and casting/scooping occur.
2. Pelvic Disassociation (X-Factor): If the golfer spins their hips during trunk rotation (>25°), they cannot create dynamic separation. Power is lost and lumbar shear stress increases.
3. Asymmetry + Dip: Asymmetry between backswing and follow-through side bends or dips (>12°) predisposes the golfer to reverse spine angle or lateral sway/slide.

Tone:
Elite, professional, encouraging, and razor-sharp.
Format: Return strict JSON conforming to the requested schema.
`;

export interface PresetQuestion {
  id: string;
  label: string;
  query: string;
}

export const PRESET_QUESTIONS: Record<SupportedLanguage, PresetQuestion[]> = {
  'sv-SE': [
    {
      id: 'why_back',
      label: 'Varför kände jag av ländryggen?',
      query: 'Varför kände jag av ländryggen under mina höftfällningar utifrån mina uppmätta vinklar?'
    },
    {
      id: 'golf_setup',
      label: 'Hur ska min golfuppställning se ut?',
      query: 'Hur bör min uppställning (adressering) med järnklubbor se ut baserat på min rörlighet i testet?'
    },
    {
      id: 'fix_neck',
      label: 'Hur tränar jag bort nacklyftet?',
      query: 'Vad är den bästa övningen för att hålla nacken neutral och blicken rätt under fällningen och svingen?'
    },
    {
      id: 'early_extension',
      label: 'Hur undviker jag Early Extension?',
      query: 'Hur hjälper dessa höftfällningsövningar mig att inte skjuta fram höften i nedsvingen?'
    }
  ],
  'en-US': [
    {
      id: 'why_back',
      label: 'Why did my lower back feel tight?',
      query: 'Based on my measured angles, why did I feel tension in my lower back during the hip hinge?'
    },
    {
      id: 'golf_setup',
      label: 'How should my golf setup look?',
      query: 'How should my golf posture at address look with irons based on my mobility numbers?'
    },
    {
      id: 'fix_neck',
      label: 'How do I stop craning my neck?',
      query: 'What is the best cue or drill to keep my neck neutral instead of looking up?'
    },
    {
      id: 'early_extension',
      label: 'How does this prevent early extension?',
      query: 'How does this hip hinge pattern prevent me from thrusting my hips toward the ball on the downswing?'
    }
  ]
};

export const PRESET_ROTATION_QUESTIONS: Record<SupportedLanguage, PresetQuestion[]> = {
  'sv-SE': [
    {
      id: 'backswing_turn',
      label: 'Hur påverkar min vänsterrotation baksvingen?',
      query: 'Hur påverkar min uppmätta bröstryggsrotation åt vänster min baksving och svingplan?'
    },
    {
      id: 'fix_asymmetry',
      label: 'Hur tränar jag bort skillnaden mellan sidorna?',
      query: 'Hur tränar jag bort min rotationsasymmetri för att skydda ryggen och få en jämnare sving?'
    },
    {
      id: 'pelvic_spin',
      label: 'Varför roterar höfterna med?',
      query: 'Varför är det svårt att hålla höfterna stilla när jag vrider överkroppen, och hur påverkar det min X-Factor?'
    },
    {
      id: 'increase_speed',
      label: 'Hur ger ökad rotation mer klubbhastighet?',
      query: 'Hur kan ökad bröstryggsrörlighet ge mig högre klubbhastighet utan att jag behöver ta i mer med armarna?'
    }
  ],
  'en-US': [
    {
      id: 'backswing_turn',
      label: 'How does my left turn affect my backswing?',
      query: 'How does my measured left thoracic rotation affect my backswing depth and swing plane?'
    },
    {
      id: 'fix_asymmetry',
      label: 'How do I fix my rotational asymmetry?',
      query: 'What is the best way to correct my rotational asymmetry to protect my spine and swing consistently?'
    },
    {
      id: 'pelvic_spin',
      label: 'Why do my hips spin with my torso?',
      query: 'Why do my hips rotate when trying to turn my shoulders, and how does that affect my X-Factor?'
    },
    {
      id: 'increase_speed',
      label: 'How does more rotation add club speed?',
      query: 'How does improved thoracic mobility increase clubhead speed without having to swing harder with my arms?'
    }
  ]
};

export const PRESET_HOLISTIC_QUESTIONS: Record<SupportedLanguage, PresetQuestion[]> = {
  'sv-SE': [
    {
      id: 'holistic_interaction',
      label: 'Hur hänger mina resultat ihop i svingen?',
      query: 'Hur samverkar min höftfällning och min bröstryggsrotation i golfsvingen utifrån mina testresultat?'
    },
    {
      id: 'fix_early_extension',
      label: 'Hur tränar jag bort Early Extension?',
      query: 'Vilken är den viktigaste åtgärden för att jag ska slippa skjuta fram höften i nedsvingen (Early Extension)?'
    },
    {
      id: 'unlock_speed',
      label: 'Hur ökar jag klubbhastigheten?',
      query: 'Hur hjälper bättre bäckendissociation och bröstryggsrörlighet mig att öka svinghastigheten?'
    },
    {
      id: 'priority_drill',
      label: 'Vilken övning ska jag prioritera först?',
      query: 'Om jag bara har 10 minuter om dagen, vilken övning ger störst effekt på min golfsving?'
    }
  ],
  'en-US': [
    {
      id: 'holistic_interaction',
      label: 'How do my results interact in the swing?',
      query: 'How do my hip hinge and thoracic rotation results interact during my golf swing?'
    },
    {
      id: 'fix_early_extension',
      label: 'How do I eliminate Early Extension?',
      query: 'What is the single most effective way to stop thrusting my hips towards the ball based on my data?'
    },
    {
      id: 'unlock_speed',
      label: 'How do I increase swing speed?',
      query: 'How does better pelvic disassociation and thoracic mobility unlock effortless clubhead speed?'
    },
    {
      id: 'priority_drill',
      label: 'Which exercise is my top priority?',
      query: 'If I only have 10 minutes a day, which specific drill will give me the biggest breakthrough?'
    }
  ]
};

export function buildAnalysisPrompt(
  report: DeviceValidationReport,
  spokenCues: SpokenCueLogEntry[],
  language: SupportedLanguage
): string {
  const repsData = report.measurement.metrics.map(m => `${m.id}: ${m.value.toFixed(1)} ${m.unit}`).join('\n');
  const compData = report.measurement.compensations.length > 0
    ? report.measurement.compensations.map(c => `- ${c.type} (${c.severity})`).join('\n')
    : 'None detected';
  const cuesData = spokenCues.length > 0
    ? spokenCues.map(c => `[${c.key}] "${c.text}"`).join('\n')
    : 'No spoken cues given';

  const langInstruction = language === 'sv-SE'
    ? 'All response text (headline, summary, golfTranslation, exercises, proTip) MUST be in natural, fluent Swedish.'
    : 'All response text MUST be in English.';

  return `
Analyze this completed 3-repetition Hip Hinge assessment:

Overall Confidence: ${(report.measurement.confidence * 100).toFixed(0)}%
Detected Repetitions: ${report.measurement.detectedRepCount}

Detailed Measurements:
${repsData}

Compensations Detected:
${compData}

Spoken Coaching Cues During Test:
${cuesData}

${langInstruction}

Return a valid JSON object strictly matching this schema:
{
  "headline": "A short, encouraging 1-sentence headline capturing their core strength and main priority",
  "summary": "2-3 sentences explaining their movement quality, depth, and overall hip hinge performance",
  "repetitionProgression": "1-2 sentences comparing repetition 1 vs repetition 2 vs repetition 3",
  "golfTranslation": {
    "title": "Title for the golf swing impact",
    "primaryFault": "e.g. Early Extension / Loss of Posture / S-Posture",
    "explanation": "Clear explanation of how their specific angles affect their golf swing setup, backswing, or impact"
  },
  "exercises": [
    {
      "name": "Exercise name",
      "target": "Target muscle / mobility focus",
      "prescription": "e.g. 2 set x 8 reps",
      "instructions": "Clear step-by-step instructions on how to do it",
      "whyThisHelps": "Why this specifically addresses their test result"
    },
    {
      "name": "Second exercise name",
      "target": "Target muscle / mobility focus",
      "prescription": "e.g. 2 set x 10 reps",
      "instructions": "Clear step-by-step instructions",
      "whyThisHelps": "Why this helps their swing"
    }
  ],
  "proTip": "One actionable nugget they can think about next time they are on the driving range"
}
`;
}

export function buildRotationAnalysisPrompt(
  rotationResult: {
    maxRotationLeft: number;
    maxRotationRight: number;
    rotationAsymmetry: number;
    totalShoulderTurnLeft: number;
    totalShoulderTurnRight: number;
    pelvicTurnAtPeakLeft: number;
    pelvicTurnAtPeakRight: number;
    compensations: {
      excessiveLateralTilt: boolean;
      excessivePelvicRotation: boolean;
      severeAsymmetry: boolean;
    };
  },
  spokenCues: SpokenCueLogEntry[],
  language: SupportedLanguage
): string {
  const compList: string[] = [];
  if (rotationResult.compensations.severeAsymmetry) {
    compList.push(`Severe Rotational Asymmetry (${rotationResult.rotationAsymmetry.toFixed(1)}° difference between Left and Right)`);
  }
  if (rotationResult.compensations.excessivePelvicRotation) {
    compList.push(`Excessive Pelvic Rotation (> 25° hip spin, lacks pelvic-thoracic disassociation / X-Factor)`);
  }
  if (rotationResult.compensations.excessiveLateralTilt) {
    compList.push(`Excessive Lateral Shoulder Tilt / Dip (> 12° side bend during rotation)`);
  }
  const compData = compList.length > 0 ? compList.map(c => `- ${c}`).join('\n') : 'None detected (excellent clean rotation)';

  const cuesData = spokenCues.length > 0
    ? spokenCues.map(c => `[${c.key}] "${c.text}"`).join('\n')
    : 'No spoken cues given';

  const langInstruction = language === 'sv-SE'
    ? 'All response text (headline, summary, golfTranslation, exercises, proTip) MUST be in natural, fluent Swedish.'
    : 'All response text MUST be in English.';

  return `
Analyze this completed Thoracic (Trunk) Rotation screening:

Peak Isolated Thoracic Rotation:
- LEFT (Backswing for right-handed golfer): ${rotationResult.maxRotationLeft.toFixed(1)}° (Elite: > 50°, Good: 40-50°, Restricted: < 40°)
- RIGHT (Follow-through for right-handed golfer): ${rotationResult.maxRotationRight.toFixed(1)}° (Elite: > 50°, Good: 40-50°, Restricted: < 40°)
- Rotational Asymmetry: ${rotationResult.rotationAsymmetry.toFixed(1)}°

Pelvis & Shoulder Kinematics:
- Total Shoulder Turn Left: ${rotationResult.totalShoulderTurnLeft.toFixed(1)}° (Pelvic rotation at peak: ${rotationResult.pelvicTurnAtPeakLeft.toFixed(1)}°)
- Total Shoulder Turn Right: ${rotationResult.totalShoulderTurnRight.toFixed(1)}° (Pelvic rotation at peak: ${rotationResult.pelvicTurnAtPeakRight.toFixed(1)}°)

Compensations Detected:
${compData}

Spoken Coaching Cues During Test:
${cuesData}

${langInstruction}

Return a valid JSON object strictly matching this schema:
{
  "headline": "A short, encouraging 1-sentence headline capturing their rotation strength and main priority",
  "summary": "2-3 sentences explaining their thoracic mobility, X-Factor disassociation, and rotational balance",
  "repetitionProgression": "1-2 sentences comparing Left rotation vs Right rotation and what the asymmetry reveals",
  "golfTranslation": {
    "title": "Title for the golf swing impact (e.g. Backswing Turn & X-Factor Potential / Reverse Spine Risk)",
    "primaryFault": "e.g. Restricted Backswing Coil / Reverse Spine Angle / Sway & Slide / Arm Lift Compensation",
    "explanation": "Clear explanation of how their specific thoracic angles affect backswing coil, club speed, or follow-through release"
  },
  "exercises": [
    {
      "name": "Exercise name (e.g. Thoracic Open Books / Seated Bar Rotations / Quadruped Rib Rolls)",
      "target": "Thoracic mobility & pelvic separation",
      "prescription": "e.g. 2 set x 10 reps/side",
      "instructions": "Clear step-by-step instructions on how to do it",
      "whyThisHelps": "Why this specifically improves their turn and protects their lumbar spine"
    },
    {
      "name": "Second exercise name",
      "target": "Target muscle / mobility focus",
      "prescription": "e.g. 2 set x 8 reps/side",
      "instructions": "Clear step-by-step instructions",
      "whyThisHelps": "Why this helps their swing"
    }
  ],
  "proTip": "One actionable nugget they can think about next time they are on the driving range (e.g. chest turn vs arm lift)"
}
`;
}

export function buildHolisticScreeningPrompt(
  hingeReport: DeviceValidationReport | null,
  rotationResult: ThoracicRotationResult | null,
  score: GolfBodyScoreResult,
  spokenCues: SpokenCueLogEntry[],
  language: SupportedLanguage
): string {
  const langInstruction = language === 'sv-SE'
    ? 'All response text (headline, summary, repetitionProgression, golfTranslation, exercises, proTip) MUST be in natural, fluent Swedish.'
    : 'All response text MUST be in English.';

  const cuesData = spokenCues.length > 0
    ? spokenCues.map(c => `[${c.key}] "${c.text}"`).join('\n')
    : 'No spoken cues given';

  const hingeMetricsStr = hingeReport && hingeReport.measurement
    ? `Avg Hinge Angle: ${score.hipHinge.avgHingeAngle}°, Avg Knee Angle: ${score.hipHinge.avgKneeAngle}°, Sub-Score: ${score.hipHinge.total}/50 (Depth: ${score.hipHinge.depthScore}/25, Knee: ${score.hipHinge.kneeScore}/15, Spine: ${score.hipHinge.spineScore}/10). Compensations: ${score.hipHinge.compensations.join(', ') || 'None'}`
    : 'Hip hinge test data not available';

  const rotMetricsStr = rotationResult
    ? `Left Turn: ${score.thoracic.maxLeft}°, Right Turn: ${score.thoracic.maxRight}°, Asymmetry: ${score.thoracic.asymmetry}°, Max Pelvic Spin: ${score.thoracic.maxPelvicTurn}°, Sub-Score: ${score.thoracic.total}/50 (Rotation: ${score.thoracic.rotationScore}/25, Disassociation: ${score.thoracic.disassociationScore}/15, Symmetry: ${score.thoracic.symmetryScore}/5, Dip: ${score.thoracic.dipScore}/5). Excessive Dip: ${score.thoracic.hasExcessiveDip}, Excessive Pelvic Spin: ${score.thoracic.hasExcessivePelvic}`
    : 'Thoracic rotation test data not available';

  return `
Analyze this complete Golf Body Screening & Assessment:

OVERALL GOLF BODY SCORE: ${score.totalScore} / 100 (${score.tierLabel} - Tier: ${score.tier})
Key Strengths:
${score.keyStrengths.map(s => `- ${s}`).join('\n')}
Primary Bottlenecks:
${score.primaryBottlenecks.map(b => `- ${b}`).join('\n')}

PART 1: HIP HINGE (POSTERIOR CHAIN & POSTURE STABILITY)
${hingeMetricsStr}

PART 2: THORACIC ROTATION (MOBILITY & X-FACTOR SEPARATION)
${rotMetricsStr}

Spoken Coaching Cues During Assessments:
${cuesData}

${langInstruction}

Instructions:
1. "headline": Inspiring 1-sentence headline capturing their Golf Body Score and chief biomechanical priority.
2. "summary": 2-3 sentences synthesizing how their hip hinge posture stability and thoracic rotational mobility complement or hinder each other.
3. "repetitionProgression": 1-2 sentences highlighting the biomechanical connection between pelvic stillness and thoracic winding (X-Factor).
4. "golfTranslation":
   - "title": "Golf-SWOT & Svingpåverkan" (or "Golf-SWOT & Swing Analysis")
   - "primaryFault": The combined primary fault (e.g. "Early Extension & Loss of Posture", "Restricted Coil with Arm Lift", "Reverse Spine Angle").
   - "explanation": In-depth 2-3 sentence analysis of how their lower body stability and upper body rotation interact to cause this fault, and the exact swing consequences (timing, strike quality, distance, back pain risk).
5. "exercises": Exactly THREE prioritized corrective exercises:
   - Exercise 1: Hip Hinge / Posterior Chain drill addressing their hinge test.
   - Exercise 2: Thoracic mobility / Rib cage rotation drill addressing their rotation test.
   - Exercise 3: Integrated Pelvic-Thoracic Disassociation drill (X-Factor training in golf posture).
   For each exercise provide: name, target, prescription, instructions, whyThisHelps.
6. "proTip": One memorable, high-impact Range Pro Tip to apply on the course or driving range.

Return a valid JSON object strictly matching this schema:
{
  "headline": "Short encouraging headline",
  "summary": "Summary of combined movement profile",
  "repetitionProgression": "Pelvis vs thoracic separation observation",
  "golfTranslation": {
    "title": "Golf-SWOT title",
    "primaryFault": "Primary swing fault",
    "explanation": "Detailed biomechanical interaction explanation"
  },
  "exercises": [
    {
      "name": "Exercise 1 name",
      "target": "Target area",
      "prescription": "Prescription",
      "instructions": "Instructions",
      "whyThisHelps": "Why this helps"
    },
    {
      "name": "Exercise 2 name",
      "target": "Target area",
      "prescription": "Prescription",
      "instructions": "Instructions",
      "whyThisHelps": "Why this helps"
    },
    {
      "name": "Exercise 3 name",
      "target": "Target area",
      "prescription": "Prescription",
      "instructions": "Instructions",
      "whyThisHelps": "Why this helps"
    }
  ],
  "proTip": "Actionable range tip"
}
`;
}

