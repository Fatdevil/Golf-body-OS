/**
 * Human-Readable Labels — Translates technical terms to everyday language.
 *
 * Used throughout the consumer-facing UI to present screening results
 * in a way that golfers (not engineers) understand.
 *
 * @module human-readable
 */

// ---------------------------------------------------------------------------
// Compensation Labels
// ---------------------------------------------------------------------------

export interface CompensationLabel {
  sv: string;
  en: string;
  tipSv: string;
  tipEn: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const COMPENSATION_LABELS: Record<string, CompensationLabel> = {
  CERVICAL_CRANING: {
    sv: 'Huvudet föll framåt',
    en: 'Head dropped forward',
    tipSv: 'Tänk på att hålla blicken rakt fram under fällningen',
    tipEn: 'Keep your gaze forward during the hinge movement',
    severity: 'MEDIUM',
  },
  EXCESSIVE_KNEE_BEND: {
    sv: 'För mycket knäböj',
    en: 'Too much knee bend',
    tipSv: 'Fäll från höfterna — inte knäna. Tänk "skjut baken bakåt"',
    tipEn: 'Hinge from the hips — not the knees. Think "push your hips back"',
    severity: 'HIGH',
  },
  LOCKED_KNEES: {
    sv: 'Låsta knän',
    en: 'Locked knees',
    tipSv: 'Håll en lätt böjning i knäna under hela rörelsen',
    tipEn: 'Maintain a slight knee bend throughout the movement',
    severity: 'MEDIUM',
  },
  NO_POSTERIOR_SHIFT: {
    sv: 'Ingen bakåtförskjutning av höften',
    en: 'No posterior hip shift',
    tipSv: 'Skjut sätesmuskeln bakåt medan du fäller framåt',
    tipEn: 'Push your glutes back as you hinge forward',
    severity: 'MEDIUM',
  },
  excessiveLateralTilt: {
    sv: 'Axeln dippade nedåt',
    en: 'Shoulder dipped sideways',
    tipSv: 'Håll axlarna i linje under rotationen — undvik att dippa',
    tipEn: 'Keep shoulders level during rotation — avoid dipping',
    severity: 'MEDIUM',
  },
  excessivePelvicRotation: {
    sv: 'Höften roterade med',
    en: 'Hips rotated too much',
    tipSv: 'Lås höfterna och rotera enbart bröstryggen',
    tipEn: 'Lock your hips and rotate only through the thoracic spine',
    severity: 'HIGH',
  },
  severeAsymmetry: {
    sv: 'Stor skillnad mellan vänster och höger',
    en: 'Significant left/right imbalance',
    tipSv: 'Fokusera på att vrida lika långt åt båda hållen',
    tipEn: 'Focus on rotating equally in both directions',
    severity: 'HIGH',
  },
};

// ---------------------------------------------------------------------------
// Metric Labels
// ---------------------------------------------------------------------------

export interface MetricLabel {
  sv: string;
  en: string;
  optimal: string;
}

export const METRIC_LABELS: Record<string, MetricLabel> = {
  HIP_HINGE_ANGLE_2D: {
    sv: 'Höftfällning',
    en: 'Hip Hinge Depth',
    optimal: '≤ 90°',
  },
  KNEE_ANGLE_AT_ENDPOINT: {
    sv: 'Knävinkel',
    en: 'Knee Angle',
    optimal: '150–165°',
  },
  TRUNK_INCLINATION: {
    sv: 'Bållutning',
    en: 'Trunk Inclination',
    optimal: '80–95°',
  },
  SHANK_INCLINATION: {
    sv: 'Skenbenslutning',
    en: 'Shank Inclination',
    optimal: '< 12°',
  },
  POSTERIOR_HIP_SHIFT: {
    sv: 'Höftförskjutning',
    en: 'Hip Shift',
    optimal: '> 0.10',
  },
};

// ---------------------------------------------------------------------------
// Quality Rating
// ---------------------------------------------------------------------------

export type QualityRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export function getQualityLabel(quality: QualityRating, lang: 'sv' | 'en'): string {
  const labels: Record<QualityRating, { sv: string; en: string }> = {
    EXCELLENT: { sv: 'Utmärkt', en: 'Excellent' },
    GOOD: { sv: 'Bra', en: 'Good' },
    FAIR: { sv: 'Måttlig', en: 'Fair' },
    POOR: { sv: 'Begränsad', en: 'Limited' },
  };
  return labels[quality][lang];
}

export function getQualityColor(quality: QualityRating): string {
  switch (quality) {
    case 'EXCELLENT': return 'text-emerald-400';
    case 'GOOD': return 'text-blue-400';
    case 'FAIR': return 'text-amber-400';
    case 'POOR': return 'text-red-400';
  }
}

export function getQualityBg(quality: QualityRating): string {
  switch (quality) {
    case 'EXCELLENT': return 'bg-emerald-500/20 border-emerald-500/40';
    case 'GOOD': return 'bg-blue-500/20 border-blue-500/40';
    case 'FAIR': return 'bg-amber-500/20 border-amber-500/40';
    case 'POOR': return 'bg-red-500/20 border-red-500/40';
  }
}

// ---------------------------------------------------------------------------
// Angle Quality Assessment
// ---------------------------------------------------------------------------

export function assessHingeAngleQuality(angleDeg: number): QualityRating {
  if (angleDeg <= 90) return 'EXCELLENT';
  if (angleDeg <= 105) return 'GOOD';
  if (angleDeg <= 125) return 'FAIR';
  return 'POOR';
}

export function assessKneeAngleQuality(angleDeg: number): QualityRating {
  if (angleDeg >= 150 && angleDeg <= 165) return 'EXCELLENT';
  if (angleDeg >= 140 && angleDeg <= 175) return 'GOOD';
  return 'FAIR';
}

export function assessRotationQuality(avgDeg: number): QualityRating {
  if (avgDeg >= 45) return 'EXCELLENT';
  if (avgDeg >= 35) return 'GOOD';
  if (avgDeg >= 25) return 'FAIR';
  return 'POOR';
}

// ---------------------------------------------------------------------------
// Swing Fault Labels (from BodySwingCorrelator)
// ---------------------------------------------------------------------------

export const SWING_FAULT_LABELS: Record<string, { sv: string; en: string }> = {
  EARLY_EXTENSION: {
    sv: 'Early Extension — höften skjuts mot bollen i nedsvingen',
    en: 'Early Extension — hips thrust toward the ball in the downswing',
  },
  REVERSE_SPINE_ANGLE: {
    sv: 'Omvänd ryggradsvinkel — överdriven sidolut i toppen',
    en: 'Reverse Spine Angle — excessive lateral tilt at the top',
  },
  LOSS_OF_POSTURE: {
    sv: 'Posturförlust — höjd eller sänkt kropp genom svingen',
    en: 'Loss of Posture — standing up or dipping through the swing',
  },
  LIMITED_TURN: {
    sv: 'Begränsad rotationsvinkel — kort baksving',
    en: 'Limited Turn — shortened backswing rotation',
  },
  SWAY: {
    sv: 'Sway — lateral höftrörelse i baksvingen',
    en: 'Sway — lateral hip movement during backswing',
  },
  SLIDE: {
    sv: 'Slide — lateral höftrörelse i nedsvingen',
    en: 'Slide — lateral hip movement during downswing',
  },
};
