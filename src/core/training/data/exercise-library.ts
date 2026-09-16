/**
 * Curated Exercise Library V1 — 20 quality-assured exercises.
 *
 * Distribution:
 *   8 MOBILITY — ROM improvement
 *   4 CONTROL  — Motor control / stability
 *   5 STRENGTH — Load tolerance / capacity
 *   3 RECOVERY — Active recovery / cool-down
 *
 * Every exercise has:
 * - Bilingual instructions (sv/en)
 * - Progression/regression paths
 * - Contraindication tags
 * - Golf swing fault relevance
 * - Default dose with RPE target
 *
 * To add exercises: append to this array and update LIBRARY_VERSION.
 *
 * @module exercise-library
 */

import type { Exercise } from '../types/exercise';

/** Semantic version of the exercise library */
export const LIBRARY_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════════════════════════════
// MOBILITY (8 exercises)
// ═══════════════════════════════════════════════════════════════════════════

const MOB_01_90_90_HIP_ROTATION: Exercise = {
  id: 'mob-01-90-90-hip-rotation',
  name: { sv: '90/90 Höftrotation', en: '90/90 Hip Rotation' },
  category: 'MOBILITY',
  bodyRegions: ['HIP', 'GLUTE'],
  targetFindings: ['hip-rotation-limited', 'hip-rotation-asymmetry'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 8, holdSeconds: 3, tempoDescription: { sv: 'Långsamt och kontrollerat', en: 'Slow and controlled' }, restSeconds: 30, rpe: 3 },
  estimatedDurationSec: 180,
  contraindicationTags: ['KNEE_LEFT', 'KNEE_RIGHT', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: [],
  progressions: ['mob-02-90-90-active-lift'],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Begränsad höftrotation tvingar kroppen att resa sig i nedsvingen', en: 'Limited hip rotation forces the body to stand up in the downswing' } },
    { swingFault: 'SWAY', explanation: { sv: 'Bättre höftrotation tillåter rotation istället för lateral rörelse', en: 'Better hip rotation allows rotation instead of lateral movement' } },
  ],
  compatibleFindings: ['hip-rotation-limited', 'hip-rotation-asymmetry', 'hip-mobility-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Sitt på golvet med ena benet i 90° framåt och det andra i 90° bakåt. Luta långsamt överkroppen mot det främre knät. Håll ryggen rak. Byt sida efter alla reps.',
    en: 'Sit on the floor with one leg at 90° in front and the other at 90° behind. Slowly lean your torso toward the front knee. Keep your back straight. Switch sides after all reps.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Sitt rak — tänk längd i ryggraden', en: 'Sit tall — think length through the spine' } },
    { atSecond: 5, cue: { sv: 'Luta framåt från höften, inte ryggen', en: 'Lean forward from the hip, not the back' } },
  ],
};

const MOB_02_90_90_ACTIVE_LIFT: Exercise = {
  id: 'mob-02-90-90-active-lift',
  name: { sv: '90/90 Aktiv Lyft', en: '90/90 Active Lift' },
  category: 'MOBILITY',
  bodyRegions: ['HIP', 'GLUTE'],
  targetFindings: ['hip-rotation-limited', 'hip-rotation-asymmetry'],
  difficulty: 'INTERMEDIATE',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 6, holdSeconds: 5, tempoDescription: { sv: 'Lyft och håll i 5 sek', en: 'Lift and hold for 5 sec' }, restSeconds: 30, rpe: 4 },
  estimatedDurationSec: 180,
  contraindicationTags: ['KNEE_LEFT', 'KNEE_RIGHT', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: ['mob-01-90-90-hip-rotation'],
  progressions: [],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Aktiv höftrotation ger styrka i den rörelseomfång som förhindrar early extension', en: 'Active hip rotation builds strength in the range that prevents early extension' } },
  ],
  compatibleFindings: ['hip-rotation-limited', 'hip-rotation-asymmetry'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Från 90/90-position: lyft det bakre knäet 5 cm från golvet utan att luta kroppen. Håll i 5 sekunder. Kontrollera nedåt. Byt sida.',
    en: 'From the 90/90 position: lift your back knee 5 cm off the floor without leaning. Hold for 5 seconds. Control down. Switch sides.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Aktivera sätesmuskeln innan du lyfter', en: 'Engage your glute before lifting' } },
  ],
};

const MOB_03_THORACIC_OPEN_BOOKS: Exercise = {
  id: 'mob-03-thoracic-open-books',
  name: { sv: 'Thoracic Open Books', en: 'Thoracic Open Books' },
  category: 'MOBILITY',
  bodyRegions: ['THORACIC'],
  targetFindings: ['thoracic-rotation-limited', 'thoracic-rotation-asymmetry'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 8, holdSeconds: 3, tempoDescription: { sv: 'Andas ut vid rotation', en: 'Exhale during rotation' }, restSeconds: 20, rpe: 2 },
  estimatedDurationSec: 150,
  contraindicationTags: ['UPPER_BACK', 'SHOULDER_LEFT', 'SHOULDER_RIGHT'],
  regressions: [],
  progressions: ['mob-04-seated-thoracic-rotation'],
  golfRelevance: [
    { swingFault: 'REVERSE_SPINE_ANGLE', explanation: { sv: 'Ökad bröstryggsrotation minskar behovet av sidolut i baksvingen', en: 'Increased thoracic rotation reduces the need for lateral tilt in the backswing' } },
    { swingFault: 'LIMITED_TURN', explanation: { sv: 'Direkt mobilisering av bröstryggen förbättrar rotationsomfånget', en: 'Direct thoracic mobilization improves rotational range' } },
  ],
  compatibleFindings: ['thoracic-rotation-limited', 'thoracic-rotation-asymmetry', 'thoracic-mobility-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg på sidan med knäna böjda 90°. Sträck ut armarna framåt, handflatorna ihop. Öppna den övre armen som en bok — följ handen med blicken. Rotera bröstryggen, inte ländyggen. Tillbaka kontrollerat.',
    en: 'Lie on your side with knees bent 90°. Extend arms forward, palms together. Open the top arm like a book — follow the hand with your gaze. Rotate the thoracic spine, not the lower back. Return with control.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Håll knäna ihop — de rör sig inte', en: 'Keep knees together — they don\'t move' } },
    { atSecond: 4, cue: { sv: 'Andas ut och sjunk djupare i rotationen', en: 'Exhale and sink deeper into the rotation' } },
  ],
};

const MOB_04_SEATED_THORACIC_ROTATION: Exercise = {
  id: 'mob-04-seated-thoracic-rotation',
  name: { sv: 'Sittande Bröstryggsrotation med Klubba', en: 'Seated Thoracic Rotation with Club' },
  category: 'MOBILITY',
  bodyRegions: ['THORACIC'],
  targetFindings: ['thoracic-rotation-limited', 'thoracic-rotation-asymmetry', 'pelvic-over-rotation'],
  difficulty: 'INTERMEDIATE',
  equipment: ['CLUB', 'CHAIR'],
  defaultDose: { sets: 2, reps: 10, holdSeconds: 2, tempoDescription: { sv: 'Kontrollerad rotation i båda riktningar', en: 'Controlled rotation in both directions' }, restSeconds: 20, rpe: 3 },
  estimatedDurationSec: 150,
  contraindicationTags: ['UPPER_BACK', 'SHOULDER_LEFT', 'SHOULDER_RIGHT'],
  regressions: ['mob-03-thoracic-open-books'],
  progressions: [],
  golfRelevance: [
    { swingFault: 'LIMITED_TURN', explanation: { sv: 'Tränar exakt den rotation som behövs i baksvingen', en: 'Trains the exact rotation needed in the backswing' } },
    { swingFault: 'REVERSE_SPINE_ANGLE', explanation: { sv: 'Isolerad rotation utan sidolut förhindrar compensatoriska mönster', en: 'Isolated rotation without lateral tilt prevents compensatory patterns' } },
  ],
  compatibleFindings: ['thoracic-rotation-limited', 'thoracic-rotation-asymmetry', 'pelvic-over-rotation'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Sitt på en stol eller bänk med en klubba bakom nacken. Knäp händerna runt knäna för att låsa höften. Rotera långsamt åt varje sida. Känn rotationen i bröstryggen, inte ländyggen.',
    en: 'Sit on a chair or bench with a club behind your neck. Clasp your hands around your knees to lock the hips. Slowly rotate to each side. Feel the rotation in the thoracic spine, not the lower back.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Lås höften — bara överkroppen roterar', en: 'Lock the hips — only upper body rotates' } },
  ],
};

const MOB_05_WORLDS_GREATEST_STRETCH: Exercise = {
  id: 'mob-05-worlds-greatest-stretch',
  name: { sv: 'Världens Bästa Stretch', en: 'World\'s Greatest Stretch' },
  category: 'MOBILITY',
  bodyRegions: ['HIP', 'THORACIC', 'ANKLE', 'HAMSTRING'],
  targetFindings: ['hip-mobility-poor', 'thoracic-rotation-limited', 'ankle-df-limited'],
  difficulty: 'INTERMEDIATE',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 5, holdSeconds: 3, tempoDescription: { sv: 'Flöda genom varje position', en: 'Flow through each position' }, restSeconds: 20, rpe: 3 },
  estimatedDurationSec: 180,
  contraindicationTags: ['LOWER_BACK', 'KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Öppnar höfter och bröstygg samtidigt — båda kritiska för att bibehålla postur', en: 'Opens hips and thoracic simultaneously — both critical for maintaining posture' } },
  ],
  compatibleFindings: ['hip-mobility-poor', 'thoracic-rotation-limited', 'ankle-df-limited'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Utfallssteg framåt. Sätt ner inre handen mot golvet. Rotera överkroppen och sträck den yttre armen mot taket. Håll. Växla sida.',
    en: 'Lunge forward. Place the inside hand on the floor. Rotate your torso and reach the outside arm toward the ceiling. Hold. Switch sides.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Sjunk djupt i utfallet', en: 'Sink deep into the lunge' } },
    { atSecond: 5, cue: { sv: 'Öppna bröstkorgen mot taket', en: 'Open your chest toward the ceiling' } },
  ],
};

const MOB_06_WALL_HIP_HINGE: Exercise = {
  id: 'mob-06-wall-hip-hinge',
  name: { sv: 'Höftfällning mot Vägg', en: 'Wall Hip Hinge' },
  category: 'MOBILITY',
  bodyRegions: ['HIP', 'HAMSTRING', 'GLUTE'],
  targetFindings: ['hip-hinge-limited', 'hip-hinge-compensation-knee'],
  difficulty: 'BEGINNER',
  equipment: ['WALL'],
  defaultDose: { sets: 3, reps: 10, holdSeconds: 2, tempoDescription: { sv: '3 sek ner, 1 sek upp', en: '3 sec down, 1 sec up' }, restSeconds: 30, rpe: 3 },
  estimatedDurationSec: 200,
  contraindicationTags: ['LOWER_BACK', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: [],
  progressions: ['str-03-wall-tap-rdl'],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Programmerar rätt höftmönster — sätet bakåt, inte kroppen framåt', en: 'Programs correct hip pattern — hips back, not body forward' } },
    { swingFault: 'LOSS_OF_POSTURE', explanation: { sv: 'Bygger medvetenhet om höftfällning vs knäböj', en: 'Builds awareness of hip hinge vs knee bend' } },
  ],
  compatibleFindings: ['hip-hinge-limited', 'hip-hinge-compensation-knee', 'hip-hinge-compensation-cervical'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå med hälarna 15 cm från en vägg. Fäll framåt från höfterna tills sätet nuddar väggen. Håll ryggen rak och knäna mjuka (inte låsta, inte böjda). Res dig genom att trycka höfterna framåt.',
    en: 'Stand with heels 15 cm from a wall. Hinge forward from the hips until your glutes touch the wall. Keep your back straight and knees soft (not locked, not bent). Stand up by driving hips forward.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Skjut sätet bakåt mot väggen', en: 'Push your glutes back toward the wall' } },
    { atSecond: 3, cue: { sv: 'Nacken neutral — titta på golvet 2 meter framför dig', en: 'Neck neutral — look at the floor 2 meters ahead' } },
  ],
};

const MOB_07_CAT_COW: Exercise = {
  id: 'mob-07-cat-cow-segmental',
  name: { sv: 'Cat-Cow Segmentell', en: 'Cat-Cow Segmental' },
  category: 'MOBILITY',
  bodyRegions: ['THORACIC', 'LUMBAR', 'CORE'],
  targetFindings: ['thoracic-mobility-poor', 'spinal-segmentation-poor'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 8, holdSeconds: null, tempoDescription: { sv: 'Rulla genom ryggraden kotvärvel för kotvärvel', en: 'Roll through the spine vertebra by vertebra' }, restSeconds: 15, rpe: 2 },
  estimatedDurationSec: 120,
  contraindicationTags: ['LOWER_BACK'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'LOSS_OF_POSTURE', explanation: { sv: 'Förbättrad ryggradskontroll hjälper dig behålla setup-vinkeln genom svingen', en: 'Improved spinal control helps maintain setup angle through the swing' } },
  ],
  compatibleFindings: ['thoracic-mobility-poor', 'spinal-segmentation-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå på alla fyra. Rulla långsamt igenom Cat (rund rygg, häng huvudet) → Cow (svank, lyft blicken). Fokusera på att röra en kotvärvel i taget, inte hela ryggen samtidigt.',
    en: 'Start on all fours. Slowly roll through Cat (round back, drop head) → Cow (arch back, lift gaze). Focus on moving one vertebra at a time, not the whole spine at once.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Börja rörelsen från bäckenet', en: 'Initiate the movement from the pelvis' } },
  ],
};

const MOB_08_ANKLE_DORSIFLEXION: Exercise = {
  id: 'mob-08-ankle-dorsiflexion-wall',
  name: { sv: 'Ankel Dorsiflexion mot Vägg', en: 'Wall Ankle Dorsiflexion' },
  category: 'MOBILITY',
  bodyRegions: ['ANKLE', 'CALF'],
  targetFindings: ['ankle-df-limited'],
  difficulty: 'BEGINNER',
  equipment: ['WALL'],
  defaultDose: { sets: 2, reps: 10, holdSeconds: 3, tempoDescription: { sv: 'Tryck knäet mot väggen och håll', en: 'Push knee toward wall and hold' }, restSeconds: 20, rpe: 2 },
  estimatedDurationSec: 150,
  contraindicationTags: ['ANKLE_LEFT', 'ANKLE_RIGHT', 'KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Begränsad ankel-dorsiflexion tvingar lateral förskjutning av höften', en: 'Limited ankle dorsiflexion forces lateral hip shift' } },
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Bättre ankel-ROM tillåter knäna att förbli böjda genom impact', en: 'Better ankle ROM allows knees to stay flexed through impact' } },
  ],
  compatibleFindings: ['ankle-df-limited'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå med ena foten ~10 cm från en vägg. Böj knäet framåt mot väggen utan att hälen lyfter. Håll i 3 sekunder. Byt fot.',
    en: 'Stand with one foot ~10 cm from a wall. Bend the knee forward toward the wall without lifting the heel. Hold for 3 seconds. Switch foot.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Hälen stannar på golvet hela tiden', en: 'Heel stays on the floor at all times' } },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL (4 exercises)
// ═══════════════════════════════════════════════════════════════════════════

const CTL_01_SINGLE_LEG_BALANCE: Exercise = {
  id: 'ctl-01-single-leg-balance',
  name: { sv: 'Enbensstående Balans', en: 'Single-Leg Balance' },
  category: 'CONTROL',
  bodyRegions: ['HIP', 'ANKLE', 'CORE', 'GLUTE'],
  targetFindings: ['balance-poor', 'single-leg-stability-poor'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 3, reps: null, holdSeconds: 30, tempoDescription: null, restSeconds: 15, rpe: 3 },
  estimatedDurationSec: 180,
  contraindicationTags: ['ANKLE_LEFT', 'ANKLE_RIGHT', 'KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: [],
  progressions: ['ctl-02-single-leg-eyes-closed'],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Enbensstabilitet är grunden för att hålla vikten centrerad i svingen', en: 'Single-leg stability is the foundation for keeping weight centered in the swing' } },
    { swingFault: 'SLIDE', explanation: { sv: 'Bättre lateral stabilitet minskar höftglidning i nedsvingen', en: 'Better lateral stability reduces hip slide in the downswing' } },
  ],
  compatibleFindings: ['balance-poor', 'single-leg-stability-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå på ett ben med det andra knäet lyft till 90°. Håll höfterna raka. Sikta på 30 sek per sida. Titta rakt fram på en fast punkt.',
    en: 'Stand on one leg with the other knee raised to 90°. Keep hips level. Aim for 30 sec per side. Focus on a fixed point ahead.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Aktivera stående sidans sätesmuskel', en: 'Engage the standing leg\'s glute' } },
    { atSecond: 15, cue: { sv: 'Kontrollera — står höften fortfarande rakt?', en: 'Check — are your hips still level?' } },
  ],
};

const CTL_02_SINGLE_LEG_EYES_CLOSED: Exercise = {
  id: 'ctl-02-single-leg-eyes-closed',
  name: { sv: 'Enbensstående med Slutna Ögon', en: 'Single-Leg Balance Eyes Closed' },
  category: 'CONTROL',
  bodyRegions: ['HIP', 'ANKLE', 'CORE', 'GLUTE'],
  targetFindings: ['balance-poor', 'single-leg-stability-poor'],
  difficulty: 'INTERMEDIATE',
  equipment: ['NONE'],
  defaultDose: { sets: 3, reps: null, holdSeconds: 15, tempoDescription: null, restSeconds: 15, rpe: 5 },
  estimatedDurationSec: 150,
  contraindicationTags: ['ANKLE_LEFT', 'ANKLE_RIGHT'],
  regressions: ['ctl-01-single-leg-balance'],
  progressions: [],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Proprioceptiv balans utan syn ökar kroppens inre stabilitet', en: 'Proprioceptive balance without vision increases the body\'s internal stability' } },
  ],
  compatibleFindings: ['balance-poor', 'single-leg-stability-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå på ett ben som i föregående övning — men blunda. Sikta på 15 sek. Om du tappar balansen, öppna ögonen och börja om.',
    en: 'Stand on one leg as in the previous exercise — but close your eyes. Aim for 15 sec. If you lose balance, open your eyes and restart.',
  },
  cuePoints: [],
};

const CTL_03_DEAD_BUG: Exercise = {
  id: 'ctl-03-dead-bug',
  name: { sv: 'Dead Bug', en: 'Dead Bug' },
  category: 'CONTROL',
  bodyRegions: ['CORE', 'HIP', 'LUMBAR'],
  targetFindings: ['trunk-control-poor', 'pelvic-stability-poor'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 2, reps: 8, holdSeconds: null, tempoDescription: { sv: '3 sek ut, 2 sek tillbaka', en: '3 sec extend, 2 sec return' }, restSeconds: 30, rpe: 4 },
  estimatedDurationSec: 150,
  contraindicationTags: ['LOWER_BACK'],
  regressions: [],
  progressions: ['ctl-04-pallof-hold'],
  golfRelevance: [
    { swingFault: 'LOSS_OF_POSTURE', explanation: { sv: 'Bygger bålstabilitet under arm/benrörelse — samma krav som i svingen', en: 'Builds core stability during limb movement — same demand as in the swing' } },
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Stärker förmågan att hålla ländkurvan neutral under dynamisk rörelse', en: 'Strengthens ability to maintain lumbar curve during dynamic movement' } },
  ],
  compatibleFindings: ['trunk-control-poor', 'pelvic-stability-poor', 'core-weakness'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg på rygg med armar rakt upp och knän i 90°. Sträck ut höger arm och vänster ben samtidigt, långsamt. Håll ländyggen nedtryckt mot golvet. Tillbaka. Byt diagonal.',
    en: 'Lie on your back with arms straight up and knees at 90°. Extend right arm and left leg simultaneously, slowly. Press your lower back into the floor. Return. Switch diagonal.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Tryck ländyggen mot golvet — håll den där', en: 'Press your lower back into the floor — keep it there' } },
  ],
};

const CTL_04_PALLOF_HOLD: Exercise = {
  id: 'ctl-04-pallof-hold',
  name: { sv: 'Pallof Hold (Antirotation)', en: 'Pallof Hold (Anti-Rotation)' },
  category: 'CONTROL',
  bodyRegions: ['CORE', 'HIP', 'GLUTE'],
  targetFindings: ['trunk-control-poor', 'rotational-stability-poor'],
  difficulty: 'INTERMEDIATE',
  equipment: ['RESISTANCE_BAND'],
  defaultDose: { sets: 3, reps: null, holdSeconds: 20, tempoDescription: null, restSeconds: 30, rpe: 5 },
  estimatedDurationSec: 180,
  contraindicationTags: ['SHOULDER_LEFT', 'SHOULDER_RIGHT'],
  regressions: ['ctl-03-dead-bug'],
  progressions: [],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Antirotation bygger exakt den stabilitet som förhindrar lateral höftrörelse', en: 'Anti-rotation builds exactly the stability that prevents lateral hip movement' } },
    { swingFault: 'SLIDE', explanation: { sv: 'Stabil bål under rotationskraft = kontrollerad nedsvingssekvens', en: 'Stable torso under rotational force = controlled downswing sequence' } },
  ],
  compatibleFindings: ['trunk-control-poor', 'rotational-stability-poor', 'pelvic-over-rotation'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Fäst ett motståndsband i midjehöjd. Stå sidvänt. Tryck ut händerna rakt framför bröstet. Bandet vill dra dig åt sidan — motstå. Håll 20 sek. Byt sida.',
    en: 'Attach a resistance band at waist height. Stand sideways. Press hands straight out in front of your chest. The band pulls you sideways — resist. Hold 20 sec. Switch sides.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Spänn magen — banden ska inte flytta dig', en: 'Brace your core — the band shouldn\'t move you' } },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// STRENGTH / LOAD TOLERANCE (5 exercises)
// ═══════════════════════════════════════════════════════════════════════════

const STR_01_GLUTE_BRIDGE: Exercise = {
  id: 'str-01-glute-bridge',
  name: { sv: 'Glute Bridge', en: 'Glute Bridge' },
  category: 'STRENGTH',
  bodyRegions: ['GLUTE', 'HAMSTRING', 'CORE'],
  targetFindings: ['glute-activation-poor', 'hip-hinge-limited'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 3, reps: 12, holdSeconds: 2, tempoDescription: { sv: '2 sek upp, håll 2 sek, 2 sek ner', en: '2 sec up, hold 2 sec, 2 sec down' }, restSeconds: 45, rpe: 5 },
  estimatedDurationSec: 210,
  contraindicationTags: ['LOWER_BACK', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: [],
  progressions: ['str-02-single-leg-glute-bridge'],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Starka sätesr muskler håller höfterna kvar vid bollen genom impact', en: 'Strong glutes keep hips back at the ball through impact' } },
  ],
  compatibleFindings: ['glute-activation-poor', 'hip-hinge-limited', 'hip-hinge-compensation-knee'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg på rygg med knäna böjda och fötterna i golvet. Tryck igenom hälarna och lyft höften tills kroppen bildar en rak linje. Kläm ihop sätesmusklerna i toppen. Sänk kontrollerat.',
    en: 'Lie on your back with knees bent and feet on the floor. Drive through heels and lift hips until body forms a straight line. Squeeze glutes at the top. Lower with control.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Tryck igenom hälarna, inte tårna', en: 'Drive through heels, not toes' } },
    { atSecond: 3, cue: { sv: 'Kläm sätesmusklerna — HÅLL', en: 'Squeeze glutes — HOLD' } },
  ],
};

const STR_02_SINGLE_LEG_GLUTE_BRIDGE: Exercise = {
  id: 'str-02-single-leg-glute-bridge',
  name: { sv: 'Enbens Glute Bridge', en: 'Single-Leg Glute Bridge' },
  category: 'STRENGTH',
  bodyRegions: ['GLUTE', 'HAMSTRING', 'CORE'],
  targetFindings: ['glute-activation-poor', 'hip-stability-asymmetry'],
  difficulty: 'INTERMEDIATE',
  equipment: ['NONE'],
  defaultDose: { sets: 3, reps: 8, holdSeconds: 2, tempoDescription: { sv: '2 sek upp, håll 2 sek, 2 sek ner', en: '2 sec up, hold 2 sec, 2 sec down' }, restSeconds: 45, rpe: 6 },
  estimatedDurationSec: 240,
  contraindicationTags: ['LOWER_BACK', 'HIP_LEFT', 'HIP_RIGHT', 'KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: ['str-01-glute-bridge'],
  progressions: [],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Enbens sätesarbete bygger den laterala stabilitet som förhindrar sway', en: 'Single-leg glute work builds the lateral stability that prevents sway' } },
  ],
  compatibleFindings: ['glute-activation-poor', 'hip-stability-asymmetry'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Som vanlig glute bridge men med ena benet lyft rakt upp. Tryck igenom ståendes häl. Håll höfterna raka — de ska inte tippa åt sidan.',
    en: 'Like a regular glute bridge but with one leg raised straight up. Drive through the standing heel. Keep hips level — they shouldn\'t tilt.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Höften ska vara helt rak — ingen tippning', en: 'Hips must be completely level — no tilting' } },
  ],
};

const STR_03_WALL_TAP_RDL: Exercise = {
  id: 'str-03-wall-tap-rdl',
  name: { sv: 'Wall Tap RDL', en: 'Wall Tap RDL' },
  category: 'STRENGTH',
  bodyRegions: ['HIP', 'HAMSTRING', 'GLUTE', 'CORE'],
  targetFindings: ['hip-hinge-limited', 'hip-hinge-compensation-knee', 'glute-activation-poor'],
  difficulty: 'INTERMEDIATE',
  equipment: ['WALL'],
  defaultDose: { sets: 3, reps: 8, holdSeconds: 2, tempoDescription: { sv: '3 sek ner, nudda väggen, 2 sek upp', en: '3 sec down, tap wall, 2 sec up' }, restSeconds: 45, rpe: 5 },
  estimatedDurationSec: 240,
  contraindicationTags: ['LOWER_BACK', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: ['mob-06-wall-hip-hinge'],
  progressions: ['str-04-split-squat'],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Programmerar sätet att hålla sig bakom hälarna — motmedlet mot Early Extension', en: 'Programs glutes to stay behind heels — the antidote to Early Extension' } },
    { swingFault: 'LOSS_OF_POSTURE', explanation: { sv: 'Bygger styrka i höftfällningsmönstret under belastning', en: 'Builds strength in the hip hinge pattern under load' } },
  ],
  compatibleFindings: ['hip-hinge-limited', 'hip-hinge-compensation-knee', 'glute-activation-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå med hälarna 15 cm från en vägg. Fäll framåt från höfterna med mjuka knän tills sätet nuddar väggen. Driv upp genom att trycka höfterna framåt. Kontrollera hela rörelsen.',
    en: 'Stand with heels 15 cm from a wall. Hinge forward from hips with soft knees until glutes tap the wall. Drive up by pressing hips forward. Control the entire movement.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Känn vikten i hälarna hela tiden', en: 'Feel the weight in your heels throughout' } },
  ],
};

const STR_04_SPLIT_SQUAT: Exercise = {
  id: 'str-04-split-squat',
  name: { sv: 'Split Squat', en: 'Split Squat' },
  category: 'STRENGTH',
  bodyRegions: ['QUADRICEP', 'GLUTE', 'HIP', 'CORE'],
  targetFindings: ['lower-body-capacity-low', 'single-leg-stability-poor'],
  difficulty: 'INTERMEDIATE',
  equipment: ['NONE'],
  defaultDose: { sets: 3, reps: 8, holdSeconds: null, tempoDescription: { sv: '3 sek ner, 1 sek upp', en: '3 sec down, 1 sec up' }, restSeconds: 60, rpe: 6 },
  estimatedDurationSec: 270,
  contraindicationTags: ['KNEE_LEFT', 'KNEE_RIGHT', 'HIP_LEFT', 'HIP_RIGHT'],
  regressions: ['str-01-glute-bridge'],
  progressions: ['str-05-banded-clamshell'],
  golfRelevance: [
    { swingFault: 'SWAY', explanation: { sv: 'Enbens styrka ger stabilitet i viktöverföringen', en: 'Single-leg strength provides stability during weight transfer' } },
    { swingFault: 'SLIDE', explanation: { sv: 'Kontrollerad excentrisk styrka motverkar lateral förskjutning', en: 'Controlled eccentric strength counteracts lateral shift' } },
  ],
  compatibleFindings: ['lower-body-capacity-low', 'single-leg-stability-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Stå i ett långt steg. Sänk det bakre knäet kontrollerat mot golvet. Framknäet ska inte gå förbi tårna. Tryck dig upp genom den främre hälen. Gör alla reps på en sida, byt sedan.',
    en: 'Stand in a long stride. Lower the back knee toward the floor with control. Front knee should not pass the toes. Push up through the front heel. Complete all reps on one side, then switch.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Tänk "rakt ner" — inte framåt', en: 'Think "straight down" — not forward' } },
  ],
};

const STR_05_BANDED_CLAMSHELL: Exercise = {
  id: 'str-05-banded-clamshell',
  name: { sv: 'Banded Clamshell', en: 'Banded Clamshell' },
  category: 'STRENGTH',
  bodyRegions: ['HIP', 'GLUTE'],
  targetFindings: ['hip-rotation-limited', 'glute-activation-poor', 'hip-stability-asymmetry'],
  difficulty: 'BEGINNER',
  equipment: ['RESISTANCE_BAND'],
  defaultDose: { sets: 2, reps: 12, holdSeconds: 2, tempoDescription: { sv: 'Öppna kontrollerat, håll 2 sek, stäng långsamt', en: 'Open with control, hold 2 sec, close slowly' }, restSeconds: 30, rpe: 4 },
  estimatedDurationSec: 150,
  contraindicationTags: ['HIP_LEFT', 'HIP_RIGHT'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Gluteus medius-aktivering stabiliserar höften i setup och genom nedsvingen', en: 'Glute medius activation stabilizes the hip in setup and through the downswing' } },
  ],
  compatibleFindings: ['hip-rotation-limited', 'glute-activation-poor', 'hip-stability-asymmetry'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg på sidan med ett motståndsband runt knäna. Knän böjda 90°, fötter ihop. Öppna det övre knäet som en mussla utan att flytta höften. Håll 2 sek. Stäng långsamt.',
    en: 'Lie on your side with a resistance band around the knees. Knees bent 90°, feet together. Open the top knee like a clamshell without moving the hips. Hold 2 sec. Close slowly.',
  },
  cuePoints: [
    { atSecond: 0, cue: { sv: 'Höften rör sig INTE — bara knäet öppnar', en: 'Hips do NOT move — only the knee opens' } },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// RECOVERY (3 exercises)
// ═══════════════════════════════════════════════════════════════════════════

const REC_01_FOAM_ROLL_THORACIC: Exercise = {
  id: 'rec-01-foam-roll-thoracic',
  name: { sv: 'Foam Roll Bröstrygg', en: 'Foam Roll Thoracic Extension' },
  category: 'RECOVERY',
  bodyRegions: ['THORACIC'],
  targetFindings: ['thoracic-mobility-poor', 'thoracic-rotation-limited'],
  difficulty: 'BEGINNER',
  equipment: ['FOAM_ROLLER'],
  defaultDose: { sets: 1, reps: null, holdSeconds: 60, tempoDescription: { sv: 'Rulla långsamt fram och tillbaka', en: 'Roll slowly back and forth' }, restSeconds: 0, rpe: 2 },
  estimatedDurationSec: 90,
  contraindicationTags: ['UPPER_BACK'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'LIMITED_TURN', explanation: { sv: 'Mjukvävnadsarbete innan spel förbättrar akut rotationsomfång', en: 'Soft tissue work before play acutely improves rotational range' } },
  ],
  compatibleFindings: ['thoracic-mobility-poor', 'thoracic-rotation-limited'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg med foam roller under bröstryggen. Armarna korsade över bröstet. Rulla långsamt mellan skulderbladen och mitten av ryggen. Pausa vid ömma punkter.',
    en: 'Lie with foam roller under your thoracic spine. Arms crossed over chest. Slowly roll between shoulder blades and mid-back. Pause at tender spots.',
  },
  cuePoints: [],
};

const REC_02_CHILDS_POSE_ROTATION: Exercise = {
  id: 'rec-02-childs-pose-rotation',
  name: { sv: 'Barnställning med Rotation', en: 'Child\'s Pose with Rotation' },
  category: 'RECOVERY',
  bodyRegions: ['THORACIC', 'LUMBAR', 'SHOULDER'],
  targetFindings: ['thoracic-mobility-poor'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 1, reps: 6, holdSeconds: 5, tempoDescription: { sv: 'Andas djupt i varje position', en: 'Breathe deeply in each position' }, restSeconds: 0, rpe: 1 },
  estimatedDurationSec: 90,
  contraindicationTags: ['KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'REVERSE_SPINE_ANGLE', explanation: { sv: 'Mjuk avslappning av bröstrygg och lats efter spel', en: 'Gentle release of thoracic spine and lats after play' } },
  ],
  compatibleFindings: ['thoracic-mobility-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Sitt i barnställning. Placera ena handen bakom huvudet. Rotera överkroppen uppåt mot taket. Håll 5 sek. Tillbaka. Byt sida.',
    en: 'Sit in child\'s pose. Place one hand behind your head. Rotate your torso upward toward the ceiling. Hold 5 sec. Return. Switch sides.',
  },
  cuePoints: [],
};

const REC_03_FIGURE_4_STRETCH: Exercise = {
  id: 'rec-03-figure-4-stretch',
  name: { sv: 'Ryggliggande Figur-4 Stretch', en: 'Supine Figure-4 Stretch' },
  category: 'RECOVERY',
  bodyRegions: ['HIP', 'GLUTE'],
  targetFindings: ['hip-rotation-limited', 'hip-mobility-poor'],
  difficulty: 'BEGINNER',
  equipment: ['NONE'],
  defaultDose: { sets: 1, reps: null, holdSeconds: 45, tempoDescription: { sv: 'Andas djupt och slappna av', en: 'Breathe deeply and relax' }, restSeconds: 0, rpe: 1 },
  estimatedDurationSec: 120,
  contraindicationTags: ['HIP_LEFT', 'HIP_RIGHT', 'KNEE_LEFT', 'KNEE_RIGHT'],
  regressions: [],
  progressions: [],
  golfRelevance: [
    { swingFault: 'EARLY_EXTENSION', explanation: { sv: 'Avslappning av piriformis och djupa höftrotatorer efter belastning', en: 'Release of piriformis and deep hip rotators after loading' } },
  ],
  compatibleFindings: ['hip-rotation-limited', 'hip-mobility-poor'],
  incompatibleFindings: [],
  media: { thumbnailUrl: null, videoUrl: null, animationUrl: null },
  instructions: {
    sv: 'Ligg på rygg. Placera ena vristen ovanför motsatt knä (figur 4). Dra det undre benet mot bröstet. Känn stretchen i sätesmuskeln. Håll 45 sek per sida.',
    en: 'Lie on your back. Place one ankle above the opposite knee (figure 4). Pull the lower leg toward your chest. Feel the stretch in the glute. Hold 45 sec per side.',
  },
  cuePoints: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The complete curated exercise library.
 *
 * 20 exercises:
 *   8 MOBILITY
 *   4 CONTROL
 *   5 STRENGTH
 *   3 RECOVERY
 */
export const EXERCISE_LIBRARY: Exercise[] = [
  // Mobility
  MOB_01_90_90_HIP_ROTATION,
  MOB_02_90_90_ACTIVE_LIFT,
  MOB_03_THORACIC_OPEN_BOOKS,
  MOB_04_SEATED_THORACIC_ROTATION,
  MOB_05_WORLDS_GREATEST_STRETCH,
  MOB_06_WALL_HIP_HINGE,
  MOB_07_CAT_COW,
  MOB_08_ANKLE_DORSIFLEXION,

  // Control
  CTL_01_SINGLE_LEG_BALANCE,
  CTL_02_SINGLE_LEG_EYES_CLOSED,
  CTL_03_DEAD_BUG,
  CTL_04_PALLOF_HOLD,

  // Strength
  STR_01_GLUTE_BRIDGE,
  STR_02_SINGLE_LEG_GLUTE_BRIDGE,
  STR_03_WALL_TAP_RDL,
  STR_04_SPLIT_SQUAT,
  STR_05_BANDED_CLAMSHELL,

  // Recovery
  REC_01_FOAM_ROLL_THORACIC,
  REC_02_CHILDS_POSE_ROTATION,
  REC_03_FIGURE_4_STRETCH,
];

/** Convenience lookup by ID */
export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_LIBRARY.map(ex => [ex.id, ex])
);

/** Get exercises by category */
export function getExercisesByCategory(category: Exercise['category']): Exercise[] {
  return EXERCISE_LIBRARY.filter(ex => ex.category === category);
}

/** Get exercises compatible with a specific finding */
export function getExercisesForFinding(findingId: string): Exercise[] {
  return EXERCISE_LIBRARY.filter(ex => ex.compatibleFindings.includes(findingId));
}
