/**
 * AI Coach Service for Golf Body OS.
 * Manages LLM analysis via Google Gemini API with a resilient, built-in
 * clinical biomechanics expert engine fallback.
 */

import { DeviceValidationReport } from '../../validation/device-validation-report';
import { SpokenCueLogEntry } from '../coaching/audio-coach';
import { SupportedLanguage } from '../coaching/i18n/locales';
import { AiCoachAnalysis, ChatMessage, CorrectiveExercise } from './types';
import {
  buildAnalysisPrompt,
  buildRotationAnalysisPrompt,
  buildHolisticScreeningPrompt,
  GOLF_COACH_SYSTEM_PROMPT,
  HOLISTIC_COACH_SYSTEM_PROMPT,
} from './golf-coach-prompts';
import { ThoracicRotationResult } from '../metrics/thoracic-rotation-metrics';
import { GolfBodyScoreResult } from '../metrics/golf-body-score';

export interface AiCoachConfig {
  apiKey?: string;
  model?: string;
}

export class AiCoachService {
  private apiKey: string = '';
  private model: string = 'gemini-2.5-flash';

  constructor(config: AiCoachConfig = {}) {
    if (config.apiKey) {
      this.apiKey = config.apiKey;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.apiKey = window.localStorage.getItem('GBO_GEMINI_API_KEY') || '';
    }
    if (config.model) this.model = config.model;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined' && window.localStorage) {
      if (this.apiKey) {
        window.localStorage.setItem('GBO_GEMINI_API_KEY', this.apiKey);
      } else {
        window.localStorage.removeItem('GBO_GEMINI_API_KEY');
      }
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generates a complete golf biomechanics analysis.
   * If an API key is available, calls Google Gemini.
   * Otherwise, uses the built-in Local Expert Synthesizer.
   */
  public async generateAnalysis(
    report: DeviceValidationReport,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage = 'en-US'
  ): Promise<AiCoachAnalysis> {
    if (this.apiKey) {
      try {
        const analysis = await this.callGeminiApi(report, spokenCues, language);
        if (analysis) return analysis;
      } catch (err) {
        console.warn('Gemini API call failed, falling back to local expert synthesizer:', err);
      }
    }

    // Built-in high quality local synthesizer
    return this.synthesizeLocalAnalysis(report, spokenCues, language);
  }

  /**
   * Generates a complete golf biomechanics analysis for Thoracic Rotation.
   */
  public async generateRotationAnalysis(
    rotationResult: ThoracicRotationResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage = 'en-US'
  ): Promise<AiCoachAnalysis> {
    if (this.apiKey) {
      try {
        const analysis = await this.callGeminiRotationApi(rotationResult, spokenCues, language);
        if (analysis) return analysis;
      } catch (err) {
        console.warn('Gemini rotation API call failed, falling back to local expert synthesizer:', err);
      }
    }

    return this.synthesizeLocalRotationAnalysis(rotationResult, spokenCues, language);
  }

  /**
   * Generates a complete golf biomechanics analysis for the combined Full Screening (Hinge + Rotation).
   */
  public async generateHolisticScreeningAnalysis(
    hingeReport: DeviceValidationReport | null,
    rotationResult: ThoracicRotationResult | null,
    score: GolfBodyScoreResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage = 'sv-SE'
  ): Promise<AiCoachAnalysis> {
    if (this.apiKey) {
      try {
        const analysis = await this.callGeminiHolisticApi(hingeReport, rotationResult, score, spokenCues, language);
        if (analysis) return analysis;
      } catch (err) {
        console.warn('Gemini holistic API call failed, falling back to local expert synthesizer:', err);
      }
    }

    return this.synthesizeLocalHolisticAnalysis(hingeReport, rotationResult, score, spokenCues, language);
  }

  /**
   * Interactive follow-up Q&A with the coach.
   */
  public async chat(
    messages: ChatMessage[],
    report?: DeviceValidationReport | null,
    language: SupportedLanguage = 'en-US',
    rotationResult?: ThoracicRotationResult | null,
    score?: GolfBodyScoreResult | null
  ): Promise<string> {
    const latestUserMsg = messages[messages.length - 1]?.content || '';

    if (this.apiKey) {
      try {
        const reply = await this.callGeminiChat(messages, report, language, rotationResult, score);
        if (reply) return reply;
      } catch (e) {
        console.warn('Gemini chat failed, using local response:', e);
      }
    }

    return this.synthesizeLocalChatResponse(latestUserMsg, report, language, rotationResult, score);
  }

  private async callGeminiApi(
    report: DeviceValidationReport,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): Promise<AiCoachAnalysis | null> {
    const prompt = buildAnalysisPrompt(report, spokenCues, language);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: GOLF_COACH_SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API Error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      repetitionProgression: parsed.repetitionProgression || '',
      golfTranslation: parsed.golfTranslation,
      exercises: parsed.exercises,
      proTip: parsed.proTip,
      generatedAt: Date.now(),
      engineUsed: 'GEMINI_2_5_FLASH',
      language
    };
  }

  private async callGeminiRotationApi(
    rotationResult: ThoracicRotationResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): Promise<AiCoachAnalysis | null> {
    const prompt = buildRotationAnalysisPrompt(rotationResult, spokenCues, language);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: GOLF_COACH_SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API Error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      repetitionProgression: parsed.repetitionProgression || '',
      golfTranslation: parsed.golfTranslation,
      exercises: parsed.exercises,
      proTip: parsed.proTip,
      generatedAt: Date.now(),
      engineUsed: 'GEMINI_2_5_FLASH',
      language
    };
  }

  private async callGeminiHolisticApi(
    hingeReport: DeviceValidationReport | null,
    rotationResult: ThoracicRotationResult | null,
    score: GolfBodyScoreResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): Promise<AiCoachAnalysis | null> {
    const prompt = buildHolisticScreeningPrompt(hingeReport, rotationResult, score, spokenCues, language);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: HOLISTIC_COACH_SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini Holistic API Error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      repetitionProgression: parsed.repetitionProgression || '',
      golfTranslation: parsed.golfTranslation,
      exercises: parsed.exercises,
      proTip: parsed.proTip,
      generatedAt: Date.now(),
      engineUsed: 'GEMINI_2_5_FLASH',
      language
    };
  }

  private async callGeminiChat(
    messages: ChatMessage[],
    report?: DeviceValidationReport | null,
    language: SupportedLanguage = 'en-US',
    rotationResult?: ThoracicRotationResult | null,
    score?: GolfBodyScoreResult | null
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let contextData = '';
    if (score) {
      contextData = `
Complete Screening Context:
- Golf Body Score: ${score.totalScore}/100 (${score.tierLabel})
- Hip Hinge Subscore: ${score.hipHinge.total}/50 (Avg Hinge: ${score.hipHinge.avgHingeAngle}°, Avg Knee: ${score.hipHinge.avgKneeAngle}°)
- Thoracic Subscore: ${score.thoracic.total}/50 (Left: ${score.thoracic.maxLeft}°, Right: ${score.thoracic.maxRight}°, Asym: ${score.thoracic.asymmetry}°, Pelvic: ${score.thoracic.maxPelvicTurn}°)
- Key Strengths: ${score.keyStrengths.join('; ')}
- Primary Bottlenecks: ${score.primaryBottlenecks.join('; ')}
`;
    } else if (report && report.measurement) {
      const repSummary = report.measurement.metrics.map(m => `${m.id}: ${m.value.toFixed(1)}`).join(', ');
      const compSummary = report.measurement.compensations.map(c => c.type).join(', ') || 'None';
      contextData = `
User Test Context:
- Detected Reps: ${report.measurement.detectedRepCount}
- Metrics: ${repSummary}
- Compensations: ${compSummary}
`;
    } else if (rotationResult) {
      contextData = `
User Rotation Test Context:
- Turn Left: ${rotationResult.maxRotationLeft}°, Turn Right: ${rotationResult.maxRotationRight}°
- Asymmetry: ${rotationResult.rotationAsymmetry}°
- Pelvic Spin: Left ${rotationResult.pelvicTurnAtPeakLeft}°, Right ${rotationResult.pelvicTurnAtPeakRight}°
`;
    }

    const systemContext = `
${score ? HOLISTIC_COACH_SYSTEM_PROMPT : GOLF_COACH_SYSTEM_PROMPT}

${contextData}
- Target Language: ${language === 'sv-SE' ? 'Swedish' : 'English'}

Answer the golfer concisely, warmly, and practically (2-4 paragraphs max).
`;

    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const body = {
      systemInstruction: {
        parts: [{ text: systemContext }]
      },
      contents,
      generationConfig: {
        temperature: 0.6
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      throw new Error(`Gemini Chat error: ${resp.status}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Deterministic local expert synthesis based on validated metrics.
   */
  public synthesizeLocalAnalysis(
    report: DeviceValidationReport,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): AiCoachAnalysis {
    const isSv = language === 'sv-SE';
    const metrics = report.measurement.metrics;
    const comps = report.measurement.compensations.map(c => c.type);

    const hipAngles = metrics.filter(m => m.id === 'HIP_HINGE_ANGLE_2D').map(m => m.value);
    const kneeAngles = metrics.filter(m => m.id === 'KNEE_ANGLE_AT_ENDPOINT').map(m => m.value);
    const trunkAngles = metrics.filter(m => m.id === 'TRUNK_INCLINATION').map(m => m.value);

    const avgHip = hipAngles.length > 0 ? hipAngles.reduce((a, b) => a + b, 0) / hipAngles.length : 80;
    const avgKnee = kneeAngles.length > 0 ? kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length : 155;
    const avgTrunk = trunkAngles.length > 0 ? trunkAngles.reduce((a, b) => a + b, 0) / trunkAngles.length : 75;

    const hasCervical = comps.includes('CERVICAL_CRANING');
    const hasExcessiveKnee = comps.includes('EXCESSIVE_KNEE_BEND') || avgKnee < 140;
    const hasLockedKnee = comps.includes('LOCKED_KNEES') || avgKnee > 175;

    // Headline
    let headline = '';
    if (isSv) {
      if (avgHip < 80) {
        headline = 'Utmärkt rörlighet i baksida lår med stark fällningspotential!';
      } else if (hasCervical) {
        headline = 'Fin höftfällning – nästa steg är att stabilisera nacken i bottenläget.';
      } else if (hasExcessiveKnee) {
        headline = 'God rörlighet men tendens till knäböj – fäll mer i höftleden.';
      } else {
        headline = 'Stabilt och kontrollerat rörelsemönster genom alla repetitioner.';
      }
    } else {
      if (avgHip < 80) {
        headline = 'Excellent hamstring mobility with strong posterior hinge depth!';
      } else if (hasCervical) {
        headline = 'Solid hinge pattern – next focus is keeping the cervical spine neutral.';
      } else if (hasExcessiveKnee) {
        headline = 'Good mobility with a slight squat bias – drive hips back more.';
      } else {
        headline = 'Consistent and controlled movement pattern across all repetitions.';
      }
    }

    // Summary
    const summary = isSv
      ? `Du genomförde testet med en genomsnittlig höftfällningsvinkel på ${avgHip.toFixed(1)}° och en bållutning på ${avgTrunk.toFixed(1)}°. Dina knävinklar låg i snitt på ${avgKnee.toFixed(1)}°, vilket visar på god förmåga att ladda sätet och baksida lår utan att tappa balansen.`
      : `You completed the assessment with an average hip hinge angle of ${avgHip.toFixed(1)}° and a trunk inclination of ${avgTrunk.toFixed(1)}°. Your knee angles averaged ${avgKnee.toFixed(1)}°, demonstrating a solid ability to load the posterior chain without losing balance.`;

    // Repetition progression
    let repProgression = '';
    if (hipAngles.length >= 2) {
      const diff = hipAngles[hipAngles.length - 1] - hipAngles[0];
      if (isSv) {
        if (Math.abs(diff) < 6) {
          repProgression = 'Mycket hög repeterbarhet: repetition 1 och 3 skiljde sig med mindre än 6 grader, vilket visar god muskulär uthållighet.';
        } else if (diff < 0) {
          repProgression = `Du ökade djupet successivt och nådde ${hipAngles[hipAngles.length - 1].toFixed(1)}° i sista repetitionen – fin anpassning!`;
        } else {
          repProgression = 'I första repetitionen nådde du djupare än i den sista, vilket tyder på lite trötthet i bålstabiliseringen mot slutet.';
        }
      } else {
        if (Math.abs(diff) < 6) {
          repProgression = 'Excellent repeatability: reps 1 and 3 varied by less than 6 degrees, showing solid muscular endurance.';
        } else if (diff < 0) {
          repProgression = `You progressively deepened your hinge, reaching ${hipAngles[hipAngles.length - 1].toFixed(1)}° on the final rep – great adaptation!`;
        } else {
          repProgression = 'Repetition 1 was slightly deeper than repetition 3, suggesting slight core fatigue toward the finish.';
        }
      }
    }

    // Golf swing impact translation
    let golfTitle = '';
    let primaryFault = '';
    let golfExplanation = '';

    if (hasExcessiveKnee) {
      golfTitle = isSv ? 'Knädominans & Early Extension' : 'Knee Dominance & Early Extension';
      primaryFault = 'Early Extension';
      golfExplanation = isSv
        ? 'När knäna böjs för mycket under höftfällningen sätter man sig på huk istället för att ladda sätet. I golfsvingen leder detta ofta till att höfterna skjuter framåt mot bollen i nedsvingen (Early Extension), vilket gör att du reser dig upp i träffen och riskerar att toppa eller slica bollen.'
        : 'Excessive knee flexion shifts the hinge into a squat pattern. In the golf swing, this directly correlates with early pelvic extension toward the ball during the downswing, causing you to lose your posture and stand up at impact.';
    } else if (hasCervical) {
      golfTitle = isSv ? 'Nackposition & Ryggradsvinkel' : 'Cervical Craning & Spine Angle';
      primaryFault = isSv ? 'Förlust av Ryggradsvinkel' : 'Loss of Posture';
      golfExplanation = isSv
        ? 'Att titta uppåt under fällningen förlänger nackryggen och låser bröstryggen. I golfuppställningen kan detta göra att du tittar under ögonbrynen och spänner nacken, vilket begränsar axelrotationen i baksvingen och ökar belastningen på ländryggen.'
        : 'Looking up during the hinge extends the cervical spine and locks thoracic mobility. In the golf swing, this restricts full shoulder rotation on the backswing and forces lateral compensation.';
    } else if (hasLockedKnee) {
      golfTitle = isSv ? 'Låsta Knän & Ländryggskompensation' : 'Locked Knees & Lumbar Compensation';
      primaryFault = isSv ? 'S-Posture (Översvank)' : 'S-Posture';
      golfExplanation = isSv
        ? 'Spikraka knän tvingar ländryggen att ta ut hela fällningen istället för att använda höftleden. I svingen skapar detta en rigid S-posture i adresseringen som minskar höftrotationen.'
        : 'Completely locking the knees shifts load directly into the lower back. At golf address, this fosters an S-posture that impedes pelvic rotation.';
    } else {
      golfTitle = isSv ? 'Optimal Bål- och Höftvinkel' : 'Optimal Hip & Spine Setup';
      primaryFault = isSv ? 'Inga större fel (Solid grund)' : 'None (Solid Foundation)';
      golfExplanation = isSv
        ? 'Ditt fina förhållande mellan höftvinkel och bållutning gör att du har utmärkta förutsättningar för en stabil ryggradsvinkel (spine angle) genom hela svingen. Det skapar utrymme för fri rotation av axlarna runt en stabil höft.'
        : 'Your balanced hip angle and trunk tilt establish ideal conditions for maintaining your spine angle throughout the golf swing, freeing the upper torso to rotate cleanly around a stable pelvic anchor.';
    }

    // Exercises
    const exercises: CorrectiveExercise[] = [];
    if (hasCervical) {
      exercises.push({
        name: isSv ? 'Wall Hinge med Tennisboll' : 'Wall Hinge with Tennis Ball',
        target: isSv ? 'Neutral nacke & Höftfällning' : 'Neutral Cervical Spine & Hip Hinge',
        prescription: '2 set x 8 reps',
        instructions: isSv
          ? 'Ställ dig med hälarna 15 cm från en vägg. Håll en mjuk tennisboll mellan hakan och bröstet. Fäll bak höften tills rumpan nuddar väggen utan att bollen ramlar ut.'
          : 'Stand with heels 6 inches from a wall. Hold a soft tennis ball between chin and chest. Hinge hips back until glutes touch the wall without dropping the ball.',
        whyThisHelps: isSv
          ? 'Tvingar nacken att förbli helt neutral och lär kroppen att ögonen ska titta snett nedåt i golvet.'
          : 'Reinforces a neutral neck and prevents the reflex to crane up toward the target.'
      });
    }

    if (hasExcessiveKnee || exercises.length === 0) {
      exercises.push({
        name: isSv ? 'RDL (Romanian Deadlift) mot Vägg' : 'Wall Tap Romanian Deadlift',
        target: isSv ? 'Bakre kedjan & Sätesaktivering' : 'Posterior Chain & Glute Loading',
        prescription: '3 set x 10 reps',
        instructions: isSv
          ? 'Mjuka knän (ca 15° böj). Skjut rumpan rakt bakåt som om du vill stänga en bildörr med skinkorna. Håll smalbenen vertikala.'
          : 'Keep soft knees (~15° bend). Push your hips straight back as if closing a car door with your glutes. Keep shins perpendicular to the floor.',
        whyThisHelps: isSv
          ? 'Tränar bort knäböjsmönstret och bygger den styrka i sätet som förhindrar Early Extension i nedsvingen.'
          : 'Eliminates squat knee-glide and builds glute drive to anchor pelvis during downswing.'
      });
    }

    if (exercises.length < 2) {
      exercises.push({
        name: isSv ? 'Katt & Ko med Bålfokus' : 'Cat-Cow Segmental Mobility',
        target: isSv ? 'Bäckenkontroll & Ryggrad' : 'Pelvic Tilt & Spinal Articulation',
        prescription: '2 set x 8 lugna reps',
        instructions: isSv
          ? 'Stå på alla fyra. Rulla upp ryggraden kota för kota och avsluta med att tilta bäckenet under kontroll.'
          : 'On all fours, slowly articulate your spine segment by segment from tailbone to crown.',
        whyThisHelps: isSv
          ? 'Lär dig skilja på rörlighet i bäckenet och rörlighet i ländryggen för en skonsam sving.'
          : 'Improves awareness of pelvic tilt independent of lumbar spine flexion.'
      });
    }

    const proTip = isSv
      ? 'Nästa gång du står på rangen: Kontrollera att din blick vilar på bollen utan att du lyfter hakan. Känn vikten mitt på fötterna och låt armarna hänga fritt rakt under axlarna.'
      : 'Next time on the range: Ensure your eyes gaze at the ball with your chin tucked naturally. Feel your weight centered on mid-foot and let your arms hang straight down from relaxed shoulders.';

    return {
      headline,
      summary,
      repetitionProgression: repProgression,
      golfTranslation: {
        title: golfTitle,
        primaryFault,
        explanation: golfExplanation
      },
      exercises,
      proTip,
      generatedAt: Date.now(),
      engineUsed: 'LOCAL_EXPERT_SYNTHESIZER',
      language
    };
  }

  private synthesizeLocalChatResponse(
    query: string,
    report?: DeviceValidationReport | null,
    language: SupportedLanguage = 'sv-SE',
    rotationResult?: ThoracicRotationResult | null,
    score?: GolfBodyScoreResult | null
  ): string {
    const isSv = language === 'sv-SE';
    const q = query.toLowerCase();

    // Holistic / screening queries
    if (q.includes('hänger') || q.includes('samverkar') || q.includes('interact') || q.includes('resultat ihop')) {
      return isSv
        ? 'Dina resultat visar den klassiska kopplingen mellan över- och underkropp: Höftfällningen sätter ryggradsvinkeln och förankrar underkroppen i marken, medan bröstryggen skapar själva vridmomentet. Om bröstryggen är begränsad tenderar golfaren att kompensera genom att räta på kroppen och skjuta fram höften mot bollen (Early Extension).'
        : 'Your results highlight the fundamental kinetic connection: The hip hinge establishes your spinal inclination and anchors your pelvis, while the thoracic spine generates rotation. If thoracic mobility is limited, the body inevitably compensates by standing up and thrusting hips toward the ball (Early Extension).';
    }

    if (q.includes('hastighet') || q.includes('speed') || q.includes('klubb')) {
      return isSv
        ? 'Klubbhastighet skapas genom att ladda upp en elastisk spänning (X-Factor) mellan en stabil underkropp och en roterande bröstkorg. När du kan hålla höften stilla och vrida bröstryggen över 45 grader fungerar kroppen som en uppdragen fjäder – du får mer fart utan att ta i mer med armarna.'
        : 'Clubhead speed is born from the stretch-shortening cycle (X-Factor) between a stabilized pelvis and a wound thoracic spine. When your hips stay anchored while your torso coils past 45°, your body uncoils like a loaded spring—yielding higher velocity with less arm strain.';
    }

    if (q.includes('övning') || q.includes('prioritera') || q.includes('drill') || q.includes('börja med')) {
      return isSv
        ? 'Om du bara har 10 minuter: Börja med "Golf Posture Disassociation Drill" (stå i golfuppställning med korsade armar, vrid bröstet med låsta höfter). Den kopplar direkt samman båda dina testresultat till svingkänslan på banan.'
        : 'If you only have 10 minutes: Start with the "Golf Posture Disassociation Drill" (address posture with crossed arms, rotate chest while locking hips). It directly translates both assessment areas into real-world swing mechanics.';
    }

    if (q.includes('rygg') || q.includes('ländrygg') || q.includes('back')) {
      return isSv
        ? 'När man känner av ländryggen under rörelsen beror det oftast på att bröstryggen eller höften är stram, vilket tvingar ländryggen att böjas eller vridas. Genom att fälla i höftleden och rotera i bröstryggen skyddar du ländryggens kotor.'
        : 'Lower back tension occurs when tight hips or thoracic stiffness forces the lumbar spine to compensate. Pivoting strictly from the hips and rotating through the ribcage directly decompresses lumbar discs.';
    }

    if (q.includes('setup') || q.includes('uppställning') || q.includes('adressering') || q.includes('posture')) {
      return isSv
        ? 'I din golfuppställning vill du ha cirka 35–40 graders bållutning och 150–160 graders knävinkel. Med din uppmätta rörlighet har du goda förutsättningar att inta en balanserad hållning där armarna hänger avslappnat rakt under axlarna.'
        : 'In your golf setup, aim for a 35–40° trunk tilt and 150–160° knee flex. Given your measured mobility, you have a solid foundation to establish an athletic posture with relaxed arms hanging vertically below shoulders.';
    }

    if (q.includes('nack') || q.includes('neck')) {
      return isSv
        ? 'För att undvika nacklyft: Tänk att du har en liten boll under hakan som du inte får tappa. Låt blicken vandra naturligt mot golvet ca 1,5 meter framför dina tår när du fäller dig framåt.'
        : 'To eliminate cervical craning: Imagine gently holding an apple under your chin. Let your gaze shift naturally to a spot on the floor 4–5 feet in front of your feet as you hinge down.';
    }

    if (q.includes('early extension') || q.includes('höft') || q.includes('hips')) {
      return isSv
        ? 'Early Extension uppstår när sätet tappar kontakten bakåt och skjuts framåt i träffen. Genom att träna höftfällning lär du hjärnan och sätesmusklerna att hålla rumpan bakom hälarna hela vägen genom bollträffen.'
        : 'Early extension happens when glutes disengage and the pelvis thrusts forward toward the ball. Mastering the hip hinge trains your neuromuscular system to keep your glutes back through the impact zone.';
    }

    return isSv
      ? 'Tack för din fråga! Dina uppmätta resultat ger en tydlig grund för din fysiska träning. Fortsätt fokusera på att hålla underkroppen stabil medan bröstryggen roterar fritt.'
      : 'Great question! Your screening data provides a clear roadmap for your training. Continue focusing on keeping your lower body stable while your thoracic spine turns freely.';
  }

  private synthesizeLocalRotationAnalysis(
    result: ThoracicRotationResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): AiCoachAnalysis {
    const isSv = language === 'sv-SE';
    const hasAsymmetry = result.compensations.severeAsymmetry || result.rotationAsymmetry > 12;
    const hasPelvic = result.compensations.excessivePelvicRotation;
    const hasTilt = result.compensations.excessiveLateralTilt;

    let headline: string;
    let summary: string;

    if (result.maxRotationLeft >= 45 && result.maxRotationRight >= 45 && !hasAsymmetry) {
      headline = isSv
        ? 'Utmärkt symmetrisk rotationsrörlighet med god fartpotential!'
        : 'Excellent symmetrical thoracic mobility with great clubhead speed potential!';
      summary = isSv
        ? `Du uppnår ${result.maxRotationLeft.toFixed(1)}° rotation åt vänster och ${result.maxRotationRight.toFixed(1)}° åt höger med endast ${result.rotationAsymmetry.toFixed(1)}° asymmetri. Detta ger dig ett fritt rörelseomfång för en komplett baksving och en obehindrad genomgång.`
        : `You achieve ${result.maxRotationLeft.toFixed(1)}° turn Left and ${result.maxRotationRight.toFixed(1)}° Right with only ${result.rotationAsymmetry.toFixed(1)}° asymmetry. This gives you uninhibited range of motion for full backswing coil and through-impact release.`;
    } else if (hasAsymmetry) {
      headline = isSv
        ? 'Betydande rotationsasymmetri upptäckt – fokus på baksving och ryggavlastning!'
        : 'Rotational asymmetry detected – focus on backswing coil & spine protection!';
      summary = isSv
        ? `Ditt test visar en märkbar skillnad på ${result.rotationAsymmetry.toFixed(1)}° mellan vänster (${result.maxRotationLeft.toFixed(1)}°) och höger (${result.maxRotationRight.toFixed(1)}°). Denna obalans gör att kroppen ofta kompenserar med ländryggen eller genom att lyfta armarna i svingen.`
        : `Your screening reveals an asymmetry of ${result.rotationAsymmetry.toFixed(1)}° between Left (${result.maxRotationLeft.toFixed(1)}°) and Right (${result.maxRotationRight.toFixed(1)}°). This imbalance often forces the body to compensate with the lumbar spine or arm-lifting during the swing.`;
    } else {
      headline = isSv
        ? 'Begränsad bröstryggsrörlighet – potential för mer kraft och bättre svingplan!'
        : 'Restricted thoracic turn – strong upside for power and consistent swing plane!';
      summary = isSv
        ? `Din isolerade rotation når ${result.maxRotationLeft.toFixed(1)}° (vänster) och ${result.maxRotationRight.toFixed(1)}° (höger). Genom att frigöra bröstryggen kan du skapa en djupare baksving utan att tvingas överrotera höfterna.`
        : `Your isolated thoracic rotation reached ${result.maxRotationLeft.toFixed(1)}° (Left) and ${result.maxRotationRight.toFixed(1)}° (Right). Freeing up your mid-back enables a deeper backswing without over-spinning your hips.`;
    }

    const repProgression = isSv
      ? `Vänstervridning: ${result.maxRotationLeft.toFixed(1)}° | Högervridning: ${result.maxRotationRight.toFixed(1)}° (Differens: ${result.rotationAsymmetry.toFixed(1)}°). ${hasPelvic ? 'Bäckenet roterade med något för mycket (>25°), vilket minskar din X-Factor.' : 'Bäckenet hölls stabilt, vilket visar bra förmåga till dissociation.'}`
      : `Left turn: ${result.maxRotationLeft.toFixed(1)}° | Right turn: ${result.maxRotationRight.toFixed(1)}° (Diff: ${result.rotationAsymmetry.toFixed(1)}°). ${hasPelvic ? 'Pelvis rotated slightly excessively (>25°), reducing your X-Factor.' : 'Pelvis remained stable, demonstrating good disassociation.'}`;

    const golfTitle = isSv ? 'Baksvingens uppvridning & X-Factor' : 'Backswing Coil & X-Factor';
    const primaryFault = hasAsymmetry
      ? 'Rotational Asymmetry / Reverse Spine Risk'
      : hasTilt
      ? 'Lateral Shoulder Dip / Reverse Angle'
      : result.maxRotationLeft < 40
      ? 'Restricted Coil / Arm-Lift Compensation'
      : 'Optimal Thoracic Mobility';

    const golfExplanation = isSv
      ? `I en högerhänt golfsving motsvarar vänsterrotationen din baksving och högerrotationen din genomgång. Med ${result.maxRotationLeft.toFixed(1)}° åt vänster ${result.maxRotationLeft < 42 ? 'riskerar du att kompensera genom att lyfta armarna eller tappa vinkeln vid toppen.' : 'har du god kapacitet att skapa spänning (X-Factor) mellan överkropp och underkropp.'} ${hasAsymmetry ? 'Ojämnheten mellan sidorna ökar dessutom risken för trötthet i ländryggens fasetter på ena sidan.' : ''}`
      : `In a right-handed swing, left turn powers the backswing and right turn clears the finish. Achieving ${result.maxRotationLeft.toFixed(1)}° left ${result.maxRotationLeft < 42 ? 'means you risk compensating by lifting your arms or losing spinal tilt.' : 'provides great capacity to build X-Factor coil between torso and pelvis.'}`;

    const exercises: CorrectiveExercise[] = [
      {
        name: isSv ? 'Thoracic Open Books (Öppna boken)' : 'Thoracic Open Books',
        target: isSv ? 'Bröstryggsrörlighet & skulderblad' : 'Thoracic mobility & scapular glide',
        prescription: isSv ? '2 set x 10 repetitioner per sida' : '2 sets x 10 reps/side',
        instructions: isSv
          ? 'Ligg på sidan med böjda knän i 90 grader. Sträck ut armarna framför dig. För den övre armen i en stor båge över kroppen mot golvet bakom dig medan knäna förblir stadigt ihop i golvet. Andas ut i ändläget.'
          : 'Lie on your side with knees bent at 90°. Extend arms forward. Sweep the top arm in a wide arc across your body toward the floor behind you while keeping knees pinned together. Exhale at end range.',
        whyThisHelps: isSv
          ? 'Isolerar bröstryggens rotation helt från ländryggen och bäckenet, vilket direkt ökar din baksving utan att belasta korsryggen.'
          : 'Completely isolates thoracic rotation from the lumbar spine and pelvis, directly expanding your backswing range without straining your lower back.'
      },
      {
        name: isSv ? 'Sittande stavrotation (Seated Bar Turns)' : 'Seated Bar Turns',
        target: isSv ? 'X-Factor separation & bålstabilitet' : 'X-Factor disassociation & core stability',
        prescription: isSv ? '2 set x 8 kontrollerade reps per sida' : '2 sets x 8 controlled reps/side',
        instructions: isSv
          ? 'Sitt på en stol med en golfklubba över bröstet och en boll eller kudde klämd mellan knäna (för att låsa höfterna). Rotera överkroppen så långt du kan åt vänster, håll i 2 sekunder, vänd tillbaka och repetera åt höger.'
          : 'Sit upright with a golf club across your chest and a pillow or foam block squeezed between your knees to lock your pelvis. Rotate your torso as far as comfortable left, hold 2s, return, and repeat right.',
        whyThisHelps: isSv
          ? 'Lär kroppen att vrida bröstkorgen medan underkroppen är låst – exakt samma muskelkontroll som skapar svinghastighet.'
          : 'Teaches neuromuscular disassociation of the thorax from the locked pelvis—the exact mechanic that builds clubhead speed.'
      }
    ];

    const proTip = isSv
      ? 'På rangen: Känn att vänster axel pekar mot eller bakom bollen i toppen av baksvingen, medan bältesspännet bara roterat hälften så mycket. Det är ren X-Factor!'
      : 'On the range: Feel your lead shoulder turning under your chin pointing toward the ball, while your belt buckle only turns half as much. That is pure X-Factor!';

    return {
      headline,
      summary,
      repetitionProgression: repProgression,
      golfTranslation: {
        title: golfTitle,
        primaryFault,
        explanation: golfExplanation
      },
      exercises,
      proTip,
      generatedAt: Date.now(),
      engineUsed: 'LOCAL_EXPERT_SYNTHESIZER',
      language
    };
  }

  private synthesizeLocalHolisticAnalysis(
    hingeReport: DeviceValidationReport | null,
    rotationResult: ThoracicRotationResult | null,
    score: GolfBodyScoreResult,
    spokenCues: SpokenCueLogEntry[],
    language: SupportedLanguage
  ): AiCoachAnalysis {
    const isSv = language === 'sv-SE';
    const total = score.totalScore;
    const tier = score.tier;

    // Headline
    let headline = '';
    if (isSv) {
      if (tier === 'TOUR_ELITE') {
        headline = `Tour-nivå rörlighet (${total}/100)! Exceptionell förening av stabil höftfällning och fri bröstryggsmobilitet.`;
      } else if (tier === 'SOLID') {
        headline = `Stabil och atletisk golfkropp (${total}/100) med god kontroll och fin potential för ökad svingfart.`;
      } else if (tier === 'MODERATE') {
        headline = `Måttlig rörlighet (${total}/100) – prioritera bäckendissociation och ren höftfällning för jämnare bollträff.`;
      } else {
        headline = `Betydande rörelsebegränsningar (${total}/100) – korrigerande fys motverkar Early Extension och skyddar ryggen.`;
      }
    } else {
      if (tier === 'TOUR_ELITE') {
        headline = `Tour-elite mobility (${total}/100)! Outstanding pairing of hip hinge stability and thoracic rotation.`;
      } else if (tier === 'SOLID') {
        headline = `Solid athletic foundation (${total}/100) with good control and strong clubhead speed potential.`;
      } else if (tier === 'MODERATE') {
        headline = `Moderate mobility (${total}/100) – prioritize pelvic separation and clean hip hinge mechanics.`;
      } else {
        headline = `Significant movement restrictions (${total}/100) – targeted corrective drills will prevent Early Extension.`;
      }
    }

    // Summary
    const summary = isSv
      ? `Din totala Golf Body Score är ${total}/100 (${score.tierLabel}). Du uppnådde ${score.hipHinge.total}/50 på höftfällningen (snittvinkel ${score.hipHinge.avgHingeAngle}°) och ${score.thoracic.total}/50 på bröstryggsrörligheten (vänster ${score.thoracic.maxLeft}°, höger ${score.thoracic.maxRight}°). Detta ger en heltäckande bild av hur din kropp skapar vridmoment och bibehåller ryggradsvinkeln i golfsvingen.`
      : `Your overall Golf Body Score is ${total}/100 (${score.tierLabel}). You scored ${score.hipHinge.total}/50 in the hip hinge (avg angle ${score.hipHinge.avgHingeAngle}°) and ${score.thoracic.total}/50 in thoracic mobility (Left ${score.thoracic.maxLeft}°, Right ${score.thoracic.maxRight}°). This provides a complete kinematic picture of how your body creates torque and maintains posture.`;

    // Kinematic chain observation (repetitionProgression field)
    let repProgression = '';
    if (isSv) {
      if (score.thoracic.hasExcessivePelvic) {
        repProgression = `Kinematisk kedja: Höfterna snurrar med ${score.thoracic.maxPelvicTurn}° under överkroppsvridningen, vilket visar att du behöver stärka bäckendissociationen för att inte tappa uppladdningen i baksvingen.`;
      } else if (score.hipHinge.compensations.includes('EXCESSIVE_KNEE_BEND')) {
        repProgression = 'Kinematisk kedja: God överkroppskontroll men tendens till knäböj i stället för höftfällning, vilket utgör den främsta flaskhalsen mot ren bollträff.';
      } else {
        repProgression = `Kinematisk kedja: Mycket fin separation mellan bäcken (${score.thoracic.maxPelvicTurn}° vridning) och bröstrygg, kombinerat med stabil sätesladdning i fällningen.`;
      }
    } else {
      if (score.thoracic.hasExcessivePelvic) {
        repProgression = `Kinematic Chain: Hips spin ${score.thoracic.maxPelvicTurn}° during torso turn, indicating a need for pelvic disassociation training to retain backswing torque.`;
      } else if (score.hipHinge.compensations.includes('EXCESSIVE_KNEE_BEND')) {
        repProgression = 'Kinematic Chain: Sound upper torso mechanics coupled with a squat bias during hinge, identifying lower body hinge loading as your primary bottleneck.';
      } else {
        repProgression = `Kinematic Chain: Outstanding separation between pelvis (${score.thoracic.maxPelvicTurn}° turn) and thoracic spine, coupled with stable posterior chain loading.`;
      }
    }

    // Golf Translation & SWOT
    const golfTitle = isSv ? 'Golf-SWOT: Kroppens samspel i svingen' : 'Golf-SWOT: Body-Swing Interaction Analysis';
    let primaryFault = '';
    let golfExplanation = '';

    const hasEarlyExtRisk = score.hipHinge.compensations.includes('EXCESSIVE_KNEE_BEND') || score.hipHinge.depthScore < 16;
    const hasCoilRestriction = score.thoracic.rotationScore < 16 || score.thoracic.maxLeft < 40;
    const hasPelvicSpin = score.thoracic.hasExcessivePelvic || score.thoracic.maxPelvicTurn > 22;

    if (hasEarlyExtRisk && hasCoilRestriction) {
      primaryFault = isSv ? 'Early Extension & Begränsad Baksving (Dubbel Flaskhals)' : 'Early Extension & Restricted Backswing Coil';
      golfExplanation = isSv
        ? 'När bröstryggen är stram tvingas armarna att lyfta klubban i baksvingen, samtidigt som en knädominant höftfällning gör att sätet skjuts framåt mot bollen i nedsvingen (Early Extension). Detta leder till förlust av ryggradsvinkel, toppade slag och blockerade drives.'
        : 'When thoracic rotation is restricted, the arms lift the club steep on the backswing. Combined with a squatty hip hinge, the pelvis thrusts toward the ball into impact (Early Extension), leading to loss of posture, thinned shots, and blocks.';
    } else if (hasEarlyExtRisk) {
      primaryFault = isSv ? 'Early Extension (Tidig Höftframskjutning)' : 'Early Extension Risk';
      golfExplanation = isSv
        ? 'Du har fin rörlighet i överkroppen, men din fällning visar tendens att böja knäna istället för att ladda sätet bakåt. I svingen riskerar detta att trycka fram höfterna i nedsvingen, vilket lämnar mindre plats för armarna och leder till flippade händer i träffen.'
        : 'You have solid upper body rotation, but your hinge shows a squat tendency. In the swing, this pushes your hips toward the ball into impact, cramping your arm path and forcing hand-flip timing.';
    } else if (hasCoilRestriction || hasPelvicSpin) {
      primaryFault = isSv ? 'X-Factor Läckage & Armlyft' : 'X-Factor Torque Leak & Arm Lift';
      golfExplanation = isSv
        ? 'Din underkropp och höftfällning är stabil, men överkroppens rotation begränsas eller drar med sig höfterna. Detta urladdar den fjäderspänning (X-Factor) som genererar klubbhastighet och gör att du måste ta i hårdare med armar och axlar.'
        : 'Your lower body posture is solid, but upper torso rotation is restricted or over-rotates the hips. This dissipates X-Factor stretch, requiring excessive arm and shoulder effort to generate swing speed.';
    } else {
      primaryFault = isSv ? 'Inga större fel (Solid Dynamisk Hållning)' : 'None (Solid Dynamic Posture)';
      golfExplanation = isSv
        ? 'Du besitter en ovanligt harmonisk balans mellan stabil höftfällning och fri bröstryggsrotation. Detta gör att du kan behålla din ryggradsvinkel (spine angle) genom hela baksvingen och träffen, vilket skapar konsekvent bollträff och hög klubbhastighet.'
        : 'You possess a rare and harmonious balance between posterior hinge stability and thoracic rotation. This allows you to maintain spine angle throughout backswing and impact, yielding consistent compression and speed.';
    }

    // 3 Priority Corrective Exercises
    const exercises: CorrectiveExercise[] = [
      {
        name: isSv ? 'Wall Tap RDL med Mjuka Knän' : 'Wall Tap Romanian Deadlift',
        target: isSv ? 'Pelare A: Sätesladdning & Hamstrings' : 'Pillar A: Glute Loading & Posterior Chain',
        prescription: isSv ? '3 set x 10 kontrollerade reps' : '3 sets x 10 controlled reps',
        instructions: isSv
          ? 'Stå med hälarna 15 cm från en vägg. Håll en lätt böj i knäna (15°). Skjut sätet rakt bakåt tills skinkorna nuddar väggen. Håll ryggen rak och nacken neutral (blicken i golvet).'
          : 'Stand 6 inches from a wall with soft knees (~15°). Hinge hips straight backward until glutes touch the wall. Keep spine flat and neck neutral looking at the floor.',
        whyThisHelps: isSv
          ? 'Programmerar sätet att hålla sig bakom hälarna i svingen – det ultimata motmedlet mot Early Extension.'
          : 'Engrains the habit of keeping hips anchored back in the swing—the ultimate antidote to Early Extension.'
      },
      {
        name: isSv ? 'Thoracic Open Books på Sidoliggande' : 'Side-Lying Thoracic Open Books',
        target: isSv ? 'Pelare B: Bröstryggsrörlighet & Skulderblad' : 'Pillar B: Thoracic Rotation & Rib Mobility',
        prescription: isSv ? '2 set x 10 repetitioner per sida' : '2 sets x 10 reps/side',
        instructions: isSv
          ? 'Ligg på sidan med knäna böjda i 90 grader mot golvet. För den övre armen i en vid cirkelbåge över kroppen mot golvet bakom dig utan att knäna lyfter från marken. Andas ut i bottenläget.'
          : 'Lie on your side with knees stacked at 90°. Sweep top arm in a wide arc over your body toward the floor behind you without letting knees lift. Exhale fully at the end.',
        whyThisHelps: isSv
          ? 'Öppnar upp bröstryggen och revbenen så att du kan rotera fullt i baksvingen utan att belasta ländryggens diskar.'
          : 'Mobilizes the thoracic cage for full backswing turn without straining lumbar discs.'
      },
      {
        name: isSv ? 'Golf Posture Disassociation Drill' : 'Golf Posture Disassociation Drill',
        target: isSv ? 'Helhet: X-Factor & Bäckenseparation' : 'Holistic: X-Factor & Pelvic Separation',
        prescription: isSv ? '3 set x 8 reps per sida' : '3 sets x 8 reps/side',
        instructions: isSv
          ? 'Ställ dig i din vanliga golfuppställning med armarna i kors över bröstet. Håll höfterna och knäna helt orörliga medan du vrider axlarna 45° åt vänster. Håll 2 sekunder, vänd tillbaka och upprepa åt höger.'
          : 'Take your regular 7-iron golf address with arms crossed over chest. Keep knees and hips completely still while turning shoulders 45° left. Hold 2s, return, and repeat right.',
        whyThisHelps: isSv
          ? 'Länkar samman Pelare A (stabil uppställning) med Pelare B (isolerad rotation) – grunden för modern svingfart.'
          : 'Bridges Pillar A (hinged posture) with Pillar B (isolated turn)—the foundation of modern swing power.'
      }
    ];

    // Pro tip
    const proTip = isSv
      ? 'Range Pro Tip: Placera en klubba eller pegg i marken 2 meter framför dig. I baksvingen: Känn att sätet behåller kontakten bakåt samtidigt som bröstet vrider sig helt över höger lår. I träffen: Låt bröstet rotera genom utan att höften skjuts mot bollen!'
      : 'Range Pro Tip: On the practice tee, feel your glutes pushing back against an imaginary wall throughout the backswing while your chest rotates fully over your trail leg. Into impact: Clear the chest through without thrusting the pelvis forward!';

    return {
      headline,
      summary,
      repetitionProgression: repProgression,
      golfTranslation: {
        title: golfTitle,
        primaryFault,
        explanation: golfExplanation
      },
      exercises,
      proTip,
      generatedAt: Date.now(),
      engineUsed: 'LOCAL_EXPERT_SYNTHESIZER',
      language
    };
  }
}
