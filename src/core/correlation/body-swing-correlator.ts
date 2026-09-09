/**
 * Body-to-Swing Correlation Engine
 *
 * Connects physical screening results (Hip Hinge & Thoracic Rotation)
 * with high-speed golf swing kinematics to explain the root physical causes
 * behind technical swing faults.
 *
 * @module body-swing-correlator
 * @version BODY_SWING_CORRELATOR_V1
 */

import { GolfBodyScoreResult } from '../metrics/golf-body-score';
import {
  BodySwingCorrelation,
  GolfSwingAnalysisResult
} from '../types/golf-swing';

export const VERSION = 'BODY_SWING_CORRELATOR_V1';

export class BodySwingCorrelator {
  /**
   * Correlates physical screening results with golf swing analysis results.
   */
  public correlate(
    bodyResult: GolfBodyScoreResult | null,
    swingResult: GolfSwingAnalysisResult
  ): BodySwingCorrelation[] {
    const correlations: BodySwingCorrelation[] = [];

    if (!bodyResult) {
      return correlations;
    }

    const { hipHinge, thoracic } = bodyResult;
    const detectedFaultIds = new Set(swingResult.faults.map(f => f.id));

    // 1. Hip Hinge vs Early Extension & Loss of Posture
    if (detectedFaultIds.has('EARLY_EXTENSION') || detectedFaultIds.has('LOSS_OF_POSTURE')) {
      const hingeScore = hipHinge.total; // out of 50
      if (hingeScore < 38) {
        correlations.push({
          bodyTest: 'HIP_HINGE',
          bodyScore: hingeScore,
          relatedSwingFaultId: 'EARLY_EXTENSION',
          title: {
            'sv-SE': 'Höftfällningsbrist förklarar Early Extension i träffen',
            'en-US': 'Hip Hinge limitation explains Early Extension at impact'
          },
          explanation: {
            'sv-SE': `Ditt höftfällningstest visade begränsningar (poäng: ${hingeScore}/50). Eftersom kroppen saknar rörlighet att hålla sätet bakåt under dynamisk belastning, tvingas bäckenet skjuta framåt mot bollen vid P7 (Impact) för att skapa plats åt armarna.`,
            'en-US': `Your hip hinge assessment scored ${hingeScore}/50. Because the body lacks stability to maintain posterior hip depth under dynamic loading, the pelvis is forced forward toward the ball line at P7 (Impact) to create arm clearance.`
          },
          prescription: {
            'sv-SE': 'Träna höftfällning mot vägg med fokus på sätesaktivering och neutral ryggrad. Håll sätet i kontakt med tush-linjen genom bollträffen.',
            'en-US': 'Practice wall hip hinges focusing on glute activation and neutral spine. Keep glutes back on the tush line through impact.'
          }
        });
      }
    }

    // 2. Thoracic Rotation vs Over-Rotation of Pelvis at Top (P4)
    if (detectedFaultIds.has('OVER_ROTATION_PELVIS')) {
      const rotScore = thoracic.total; // out of 50
      const maxTurn = Math.max(thoracic.maxLeft, thoracic.maxRight);
      if (rotScore < 38 || maxTurn < 38) {
        correlations.push({
          bodyTest: 'THORACIC_ROTATION',
          bodyScore: rotScore,
          relatedSwingFaultId: 'OVER_ROTATION_PELVIS',
          title: {
            'sv-SE': 'Stel bröstrygg tvingar fram överroterat bäcken i baksvingen',
            'en-US': 'Thoracic stiffness forces pelvic over-rotation in backswing'
          },
          explanation: {
            'sv-SE': `Din bröstryggsrotation uppmättes till ${maxTurn}° (optimalt är 45°+). För att ändå nå upp till P4 (toppen) kompenserar kroppen genom att överrotera höfterna (${swingResult.kinematics.P4_TOP.pelvisTurn}°). Detta tömmer kroppen på torsionsspänning (X-Factor) och leder till timingproblem i nedsvingen.`,
            'en-US': `Your thoracic rotation reached only ${maxTurn}° (optimal is 45°+). To achieve swing length at P4, your body compensates by over-rotating the pelvis to ${swingResult.kinematics.P4_TOP.pelvisTurn}°, collapsing elastic torque (X-Factor).`
          },
          prescription: {
            'sv-SE': 'Sittande bröstryggsrotationer med pinne över bröstet och knäppta knän för att isolera överkroppen från underkroppen.',
            'en-US': 'Seated thoracic rotations with a club across shoulders and knees squeezed together to isolate upper body from hips.'
          }
        });
      }
    }

    // 3. Thoracic Rotation vs Reverse Spine Angle (P4)
    if (detectedFaultIds.has('REVERSE_SPINE')) {
      const rotScore = thoracic.total;
      correlations.push({
        bodyTest: 'THORACIC_ROTATION',
        bodyScore: rotScore,
        relatedSwingFaultId: 'REVERSE_SPINE',
        title: {
          'sv-SE': 'Begränsad bröstryggsrörlighet skapar omvänd ryggradsvinkel (Reverse Spine)',
          'en-US': 'Thoracic limitation causes reverse spine angle'
        },
        explanation: {
          'sv-SE': `När bröstryggen är stel kan överkroppen inte vrida sig runt ryggradens axel. Kroppen kompenserar genom att tilta ryggraden bakåt mot målet, vilket skapar skadlig kompression i ländryggen.`,
          'en-US': `When the thoracic spine is stiff, the torso cannot rotate purely around the spinal axis, compensating by tilting backwards toward target and creating high lumbar shear stress.`
        },
        prescription: {
          'sv-SE': 'Open-book stretch och skumrullning av bröstryggen innan spel för att öppna upp rotationsbanan.',
          'en-US': 'Open-book stretches and thoracic foam rolling prior to play to free up rotation.'
        }
      });
    }

    // 4. Rotational Asymmetry vs Sway / Slide
    if (detectedFaultIds.has('SWAY_BACKSWING') || detectedFaultIds.has('SLIDE_DOWNSWING')) {
      const asymmetry = thoracic.asymmetry;
      if (asymmetry > 8) {
        correlations.push({
          bodyTest: 'THORACIC_ROTATION',
          bodyScore: thoracic.total,
          relatedSwingFaultId: 'SWAY_BACKSWING',
          title: {
            'sv-SE': `Rotationsasymmetri (${asymmetry}°) orsakar glid istället för vridning`,
            'en-US': `Rotational asymmetry (${asymmetry}°) causes lateral sway instead of rotation`
          },
          explanation: {
            'sv-SE': `Du har ${asymmetry}° skillnad mellan vänster och höger rotation. Eftersom kroppen har svårare att rotera åt ena hållet väljer den minsta motståndets väg: att glida i sidled (sway/slide).`,
            'en-US': `You exhibit an asymmetry of ${asymmetry}° between left and right rotation. As a result, the body chooses the path of least resistance: sliding laterally instead of turning.`
          },
          prescription: {
            'sv-SE': 'Fokusera extra rörlighetsträning på din svaga rotationssida för att jämna ut skillnaden.',
            'en-US': 'Focus dedicated mobility work on the restricted rotation side to balance bilateral symmetry.'
          }
        });
      }
    }

    return correlations;
  }
}
