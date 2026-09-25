/**
 * Body-to-Swing Correlation Engine
 *
 * Connects physical screening results (Hip Hinge & Thoracic Rotation)
 * with high-speed golf swing kinematics to point out physical limitations that
 * may contribute to technical swing faults. A 2D video and a screening test can
 * show that both are present, not that one causes the other, so all wording is
 * framed as a possible contributing factor.
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
  public static correlate(
    bodyResult: GolfBodyScoreResult | null,
    swingResult: GolfSwingAnalysisResult
  ): BodySwingCorrelation[] {
    return new BodySwingCorrelator().correlate(bodyResult, swingResult);
  }

  public correlate(
    bodyResult: GolfBodyScoreResult | null,
    swingResult: GolfSwingAnalysisResult
  ): BodySwingCorrelation[] {
    const correlations: BodySwingCorrelation[] = [];

    if (!bodyResult) {
      return correlations;
    }

    const hipHinge = bodyResult.hipHinge;
    const thoracic = (bodyResult as any).thoracic || (bodyResult as any).thoracicRotation;
    const detectedFaultIds = new Set(swingResult.faults.map(f => f.id));

    // 1. Hip Hinge vs Early Extension & Loss of Posture
    if (detectedFaultIds.has('EARLY_EXTENSION') || detectedFaultIds.has('LOSS_OF_POSTURE')) {
      const hingeScore = hipHinge?.total ?? 50; // out of 50
      if (hingeScore < 38) {
        correlations.push({
          bodyTest: 'HIP_HINGE',
          bodyScore: hingeScore,
          relatedSwingFaultId: 'EARLY_EXTENSION',
          title: {
            'sv-SE': 'Höftfällningsbrist kan bidra till Early Extension i träffen',
            'en-US': 'Hip hinge limitation may contribute to Early Extension at impact'
          },
          explanation: {
            'sv-SE': `Ditt höftfällningstest visade begränsningar (poäng: ${hingeScore}/50). Samtidigt skjuter bäckenet framåt mot bollen vid P7 (Impact). Begränsad förmåga att hålla sätet bakåt under dynamisk belastning kan vara en bidragande faktor – bäckenet flyttar då lätt fram för att ge armarna plats.`,
            'en-US': `Your hip hinge assessment scored ${hingeScore}/50. Your pelvis also moves toward the ball line at P7 (Impact). Limited ability to keep hip depth under dynamic loading may be a contributing factor, as the pelvis then tends to move forward to create arm clearance.`
          },
          prescription: {
            'sv-SE': 'Träna höftfällning mot vägg med fokus på sätesaktivering och neutral ryggrad. Håll sätet i kontakt med tush-linjen genom bollträffen.',
            'en-US': 'Practice wall hip hinges focusing on glute activation and neutral spine. Keep glutes back on the tush line through impact.'
          }
        });
      }
    }

    // 2. Thoracic Rotation vs Over-Rotation of Pelvis at Top (P4)
    if (detectedFaultIds.has('OVER_ROTATION_PELVIS') && thoracic) {
      const rotScore = thoracic.total; // out of 50
      const maxTurn = Math.max(thoracic.maxLeft ?? 45, thoracic.maxRight ?? 45);
      if (rotScore < 38 || maxTurn < 38) {
        correlations.push({
          bodyTest: 'THORACIC_ROTATION',
          bodyScore: rotScore,
          relatedSwingFaultId: 'OVER_ROTATION_PELVIS',
          title: {
            'sv-SE': 'Stel bröstrygg kan bidra till överroterat bäcken i baksvingen',
            'en-US': 'Thoracic stiffness may contribute to pelvic over-rotation in backswing'
          },
          explanation: {
            'sv-SE': `Din bröstryggsrotation uppmättes till ${maxTurn}° (optimalt är 45°+). I svingen roterade höfterna ${swingResult.kinematics.P4_TOP?.pelvisTurn ?? 55}° vid P4 (toppen). Begränsad bröstryggsrotation kan bidra till att kroppen kompenserar med höfterna för att nå svinglängd, vilket kan minska torsionsspänningen (X-Factor) och påverka timingen i nedsvingen.`,
            'en-US': `Your thoracic rotation reached only ${maxTurn}° (optimal is 45°+). In the swing your pelvis turned ${swingResult.kinematics.P4_TOP?.pelvisTurn ?? 55}° at P4. Limited thoracic rotation may contribute to compensating with the hips to reach swing length, which can reduce elastic torque (X-Factor).`
          },
          prescription: {
            'sv-SE': 'Sittande bröstryggsrotationer med pinne över bröstet och knäppta knän för att isolera överkroppen från underkroppen.',
            'en-US': 'Seated thoracic rotations with a club across shoulders and knees squeezed together to isolate upper body from hips.'
          }
        });
      }
    }

    // 3. Thoracic Rotation vs Reverse Spine Angle (P4)
    if (detectedFaultIds.has('REVERSE_SPINE') && thoracic) {
      const rotScore = thoracic.total;
      if (rotScore < 38) {
        correlations.push({
          bodyTest: 'THORACIC_ROTATION',
          bodyScore: rotScore,
          relatedSwingFaultId: 'REVERSE_SPINE',
          title: {
            'sv-SE': 'Begränsad bröstryggsrörlighet kan bidra till omvänd ryggradsvinkel (Reverse Spine)',
            'en-US': 'Thoracic limitation may contribute to reverse spine angle'
          },
          explanation: {
            'sv-SE': `När bröstryggen är stel kan överkroppen få svårare att vrida sig runt ryggradens axel. En vanlig kompensation är att tilta ryggraden bakåt mot målet, vilket kan öka belastningen på ländryggen.`,
            'en-US': `When the thoracic spine is stiff, the torso may struggle to rotate around the spinal axis. A common compensation is tilting backwards toward the target, which can increase load on the lower back.`
          },
          prescription: {
            'sv-SE': 'Open-book stretch och skumrullning av bröstryggen innan spel för att öppna upp rotationsbanan.',
            'en-US': 'Open-book stretches and thoracic foam rolling prior to play to free up rotation.'
          }
        });
      }
    }

    // 4. Rotational Asymmetry vs Sway / Slide
    if ((detectedFaultIds.has('SWAY_BACKSWING') || detectedFaultIds.has('SLIDE_DOWNSWING')) && thoracic) {
      const asymmetry = thoracic.asymmetry;
      if (asymmetry > 8) {
        correlations.push({
          bodyTest: 'THORACIC_ROTATION',
          bodyScore: thoracic.total,
          relatedSwingFaultId: 'SWAY_BACKSWING',
          title: {
            'sv-SE': `Rotationsasymmetri (${asymmetry}°) kan bidra till glid istället för vridning`,
            'en-US': `Rotational asymmetry (${asymmetry}°) may contribute to lateral sway instead of rotation`
          },
          explanation: {
            'sv-SE': `Du har ${asymmetry}° skillnad mellan vänster och höger rotation. När kroppen har svårare att rotera åt ena hållet kan den välja minsta motståndets väg: att glida i sidled (sway/slide).`,
            'en-US': `You exhibit an asymmetry of ${asymmetry}° between left and right rotation. When rotation is harder to one side, the body may take the path of least resistance: sliding laterally instead of turning.`
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
