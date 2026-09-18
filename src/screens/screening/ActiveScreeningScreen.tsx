/**
 * ActiveScreeningScreen — Live Guided Screening Runner
 *
 * Runs Hip Hinge and/or Thoracic Rotation protocols with real-time
 * auditory cues (AudioCoachService), repetition tracking, and angle feedback.
 * Includes simulated test mode for testing without camera dependencies.
 *
 * @module ActiveScreeningScreen
 * @version ACTIVE_SCREENING_SCREEN_V1
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useScreening } from '../../context/ScreeningContext';
import { StoredScreeningSession } from '../../storage/screening-repository';
import { AudioCoachService } from '../../core/coaching/audio-coach';
import { LiveCoachingEngine } from '../../core/coaching/live-coaching-engine';
import { LiveRotationCoachingEngine } from '../../core/coaching/live-rotation-coaching-engine';
import { calculateGolfBodyScore, getTierDetailsForScore } from '../../core/metrics/golf-body-score';
import { CoachingPhraseKey } from '../../core/coaching/i18n/locales';

export default function ActiveScreeningScreen() {
  const { activeTestType, language, cancelScreening, finishScreening } = useScreening();

  // Sub-stage within screening (e.g. for FULL_BATTERY: HINGE -> ROTATION)
  const [currentStage, setCurrentStage] = useState<'HINGE' | 'STAGE_TRANSITION' | 'ROTATION'>(
    activeTestType === 'THORACIC_ROTATION' ? 'ROTATION' : 'HINGE'
  );

  const [repCount, setRepCount] = useState<number>(0);
  const [currentAngle, setCurrentAngle] = useState<number>(180);
  const [kneeAngle, setKneeAngle] = useState<number>(170);
  const [lastCue, setLastCue] = useState<string>('Ställ dig i position för att börja');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Stored measurements across stages (empty until measured)
  const hingeMetricsRef = useRef<{
    hingeAngle?: number;
    kneeAngle?: number;
    compensations: string[];
  }>({ compensations: [] });

  const rotationMetricsRef = useRef<{
    leftDeg?: number;
    rightDeg?: number;
    asymmetryDeg?: number;
    pelvicTurnDeg?: number;
    compensations: string[];
  }>({ compensations: [] });

  const audioCoachRef = useRef<AudioCoachService | null>(null);
  const liveHingeEngineRef = useRef<LiveCoachingEngine | null>(null);
  const liveRotationEngineRef = useRef<LiveRotationCoachingEngine | null>(null);

  // Interval tracking for proper cleanup
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef<boolean>(false);

  // Initialize audio coach & engines
  useEffect(() => {
    const coach = new AudioCoachService({ defaultLanguage: language });
    audioCoachRef.current = coach;

    liveHingeEngineRef.current = new LiveCoachingEngine(coach, {
      onRepComplete: (rep) => {
        setRepCount(rep);
      },
      onAllRepsComplete: () => {
        handleHingeComplete();
      },
      onCueSpoken: (key: CoachingPhraseKey) => {
        setLastCue(key);
      }
    });

    liveRotationEngineRef.current = new LiveRotationCoachingEngine(coach, {
      onComplete: () => {
        handleRotationComplete();
      },
      onCueSpoken: (key: CoachingPhraseKey) => {
        setLastCue(key);
      }
    });

    return () => {
      coach.cancel();
      // Clear any running simulation interval on unmount
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
        isRunningRef.current = false;
      }
    };
  }, [language]);

  const handleHingeComplete = useCallback(() => {
    if (activeTestType === 'FULL_BATTERY') {
      setCurrentStage('STAGE_TRANSITION');
      audioCoachRef.current?.speak('ALL_REPS_DONE');
    } else {
      finalizeOverallResult();
    }
  }, [activeTestType]);

  const handleRotationComplete = useCallback(() => {
    finalizeOverallResult();
  }, []);

  const proceedToRotation = () => {
    setCurrentStage('ROTATION');
    setRepCount(0);
    setCurrentAngle(0);
    setLastCue('Vrid bröstkorgen långsamt åt vänster');
  };

  const finalizeOverallResult = () => {
    const hasHinge = activeTestType !== 'THORACIC_ROTATION' && hingeMetricsRef.current.hingeAngle !== undefined;
    const hasRotation = activeTestType !== 'HIP_HINGE' && rotationMetricsRef.current.leftDeg !== undefined;

    // 1. Build DeviceValidationReport for Hip Hinge if performed
    const hingeReport: any = hasHinge ? {
      measurement: {
        metrics: [
          { id: 'HIP_HINGE_ANGLE_2D', value: hingeMetricsRef.current.hingeAngle },
          { id: 'KNEE_ANGLE_AT_ENDPOINT', value: hingeMetricsRef.current.kneeAngle }
        ],
        compensations: hingeMetricsRef.current.compensations.map(c => ({ type: c }))
      }
    } : null;

    // 2. Build ThoracicRotationResult if performed
    const rotResult: any = hasRotation ? {
      maxRotationLeft: rotationMetricsRef.current.leftDeg,
      maxRotationRight: rotationMetricsRef.current.rightDeg,
      rotationAsymmetry: rotationMetricsRef.current.asymmetryDeg,
      pelvicTurnAtPeakLeft: rotationMetricsRef.current.pelvicTurnDeg,
      pelvicTurnAtPeakRight: rotationMetricsRef.current.pelvicTurnDeg,
      compensations: {
        excessiveLateralTilt: false,
        excessivePelvicRotation: (rotationMetricsRef.current.pelvicTurnDeg ?? 0) > 20,
        severeAsymmetry: (rotationMetricsRef.current.asymmetryDeg ?? 0) > 12
      }
    } : null;

    // 3. Compute Golf Body Score
    const bodyScore = calculateGolfBodyScore(hingeReport, rotResult, language);

    // 4. Normalize score and category tier for individual tests (denominator consistency)
    const isIndividualTest = activeTestType === 'HIP_HINGE' || activeTestType === 'THORACIC_ROTATION';
    const normalizedScore = isIndividualTest
      ? Math.min(100, bodyScore.totalScore * 2)
      : bodyScore.totalScore;

    const tierDetails = getTierDetailsForScore(normalizedScore, language === 'sv-SE');

    // 5. Honest Body-Swing Potential Influence (no fabricated swing faults)
    const predictedFaults: StoredScreeningSession['predictedSwingFaults'] = [];
    const isSv = language === 'sv-SE';

    if (hasHinge && (hingeMetricsRef.current.hingeAngle ?? 180) > 95) {
      predictedFaults.push({
        faultId: 'EARLY_EXTENSION',
        title: isSv ? 'Möjlig påverkan: Hållning i nedsvingen' : 'Potential Influence: Downswing Posture',
        explanation: isSv
          ? 'Begränsat höftfällningsdjup kan göra det mer krävande att bibehålla bäckenets avstånd till bollen (risk för tidig extension).'
          : 'Limited hip hinge depth may make it more demanding to maintain pelvic posture through impact.',
        prescription: isSv
          ? 'Höftfällning mot vägg och sätesaktivering för stabilare höftledsrörelse.'
          : 'Wall hip hinge and glute activation for stable hip movement.'
      });
    }

    if (hasRotation && ((rotationMetricsRef.current.leftDeg ?? 45) < 35 || (rotationMetricsRef.current.rightDeg ?? 45) < 35)) {
      predictedFaults.push({
        faultId: 'LOSS_OF_POSTURE',
        title: isSv ? 'Möjlig påverkan: Svingbåge & Rotation' : 'Potential Influence: Swing Turn & Arc',
        explanation: isSv
          ? 'Minskad bröstryggsrörlighet kan fresta kroppen att kompensera med armlyft eller lateral rörelse istället för ren rotation.'
          : 'Restricted thoracic mobility can tempt compensatory arm lifting or lateral sway instead of clean rotation.',
        prescription: isSv
          ? 'Open books och bröstryggsrotation med klubba.'
          : 'Open books and seated thoracic rotation with club.'
      });
    }

    // 6. Targeted Prescribed Exercises (only relevant to performed tests)
    const prescribedExercises: StoredScreeningSession['prescribedExercises'] = [];
    if (hasHinge) {
      prescribedExercises.push({
        name: isSv ? 'Höftfällning mot vägg' : 'Wall Hip Hinge',
        targetFault: isSv ? 'Höftledsrörlighet & Hållning' : 'Hip Mobility & Posture',
        setsReps: '3 set × 10 reps',
        description: isSv ? 'Fäll från höften med neutral ryggrad och känn sätets kontakt.' : 'Hinge from hips keeping spine neutral.'
      });
    }
    if (hasRotation) {
      prescribedExercises.push({
        name: isSv ? 'Thoracic Open Books' : 'Thoracic Open Books',
        targetFault: isSv ? 'Bröstryggsrotation' : 'Thoracic Rotation',
        setsReps: '2 set × 8 reps/sida',
        description: isSv ? 'Ligg på sidan med knäna låsta och rotera bröstkorgen kontrollerat.' : 'Lie on side with knees locked, rotate torso slowly.'
      });
    }
    if (prescribedExercises.length === 0) {
      prescribedExercises.push({
        name: isSv ? 'Världens bästa stretch' : "World's Greatest Stretch",
        targetFault: isSv ? 'Allmän rörlighet' : 'General Mobility',
        setsReps: '2 set × 5 reps/sida',
        description: isSv ? 'Kombinerad höft- och bröstryggsöppnare.' : 'Combined hip and thoracic mobility opener.'
      });
    }

    const session: StoredScreeningSession = {
      id: `session_${Date.now()}`,
      timestampMs: Date.now(),
      testType: activeTestType || 'FULL_BATTERY',
      golfBodyScore: normalizedScore,
      tier: tierDetails.tier,
      tierLabel: tierDetails.tierLabel,
      tierColor: tierDetails.tierColor,
      subScores: {
        hipHinge: hasHinge ? bodyScore.hipHinge.total : 0,
        thoracicRotation: hasRotation ? bodyScore.thoracic.total : 0
      },
      angles: {
        ...(hasHinge ? {
          hipHingeFlexionDeg: hingeMetricsRef.current.hingeAngle,
          hipHingeKneeDeg: hingeMetricsRef.current.kneeAngle,
        } : {}),
        ...(hasRotation ? {
          thoracicLeftDeg: rotationMetricsRef.current.leftDeg,
          thoracicRightDeg: rotationMetricsRef.current.rightDeg,
          thoracicAsymmetryDeg: rotationMetricsRef.current.asymmetryDeg,
          pelvicTurnDeg: rotationMetricsRef.current.pelvicTurnDeg,
        } : {})
      },
      compensations: [
        ...(hasHinge ? hingeMetricsRef.current.compensations : []),
        ...(hasRotation ? rotationMetricsRef.current.compensations : [])
      ],
      primaryBottlenecks: bodyScore.primaryBottlenecks,
      predictedSwingFaults: predictedFaults,
      prescribedExercises,
      isSimulated: true,
    };

    finishScreening(session);
  };

  // Automated Simulation Runner for testing and demo
  const runSimulation = () => {
    // Guard against multiple concurrent simulations (ref-based, synchronous)
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsSimulating(true);
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (currentStage === 'HINGE') {
        if (step <= 10) {
          // Rep 1
          const angle = 180 - (step / 10) * 94; // dips to 86°
          setCurrentAngle(Math.round(angle));
          setKneeAngle(158);
          setRepCount(1);
          setLastCue('Fäll framåt från höfterna...');
        } else if (step <= 20) {
          // Rep 2
          const angle = 86 + ((step - 10) / 10) * 94;
          setCurrentAngle(Math.round(angle));
          setRepCount(2);
          setLastCue('Utmärkt djup! Sträck upp...');
        } else if (step <= 30) {
          // Rep 3
          setRepCount(3);
          setLastCue('Repetition 3 av 3 slutförd!');
          clearInterval(interval);
          simulationIntervalRef.current = null;
          isRunningRef.current = false;
          // Record simulated hinge metrics
          hingeMetricsRef.current = { hingeAngle: 86, kneeAngle: 158, compensations: [] };
          handleHingeComplete();
        }
      } else if (currentStage === 'ROTATION') {
        if (step <= 10) {
          setCurrentAngle(Math.round((step / 10) * 44)); // 44° left
          setLastCue('Vrid vänster...');
        } else if (step <= 20) {
          setCurrentAngle(Math.round(44 - ((step - 10) / 10) * 86)); // turns to right
          setLastCue('Bra! Vrid nu åt höger...');
        } else {
          setLastCue('Rotationstest klart!');
          clearInterval(interval);
          simulationIntervalRef.current = null;
          isRunningRef.current = false;
          setIsSimulating(false);
          // Record simulated rotation metrics
          rotationMetricsRef.current = { leftDeg: 44, rightDeg: 42, asymmetryDeg: 2, pelvicTurnDeg: 12, compensations: [] };
          handleRotationComplete();
        }
      }
    }, 150);

    // Store interval ID in ref for cleanup
    simulationIntervalRef.current = interval;
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={cancelScreening} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>✕ Avbryt</Text>
        </Pressable>
        <View style={styles.stageIndicator}>
          <Text style={styles.stageTitle}>
            {currentStage === 'HINGE' ? 'DELTEST 1: HÖFTFÄLLNING' : 'DELTEST 2: BRÖSTRYGG'}
          </Text>
        </View>
      </View>

      {/* Main Viewfinder / Canvas Area */}
      <View style={styles.viewfinder}>
        {currentStage === 'STAGE_TRANSITION' ? (
          <View style={styles.transitionBox}>
            <Text style={styles.transitionCheck}>✓</Text>
            <Text style={styles.transitionTitle}>Höftfällning slutförd!</Text>
            <Text style={styles.transitionDesc}>
              Vänd dig nu mot kameran squarely med armarna korsade över bröstkorgen.
            </Text>
            <Pressable style={styles.continueButton} onPress={proceedToRotation}>
              <Text style={styles.continueButtonText}>Fortsätt till bröstryggstest →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.activeOverlay}>
            {/* Live Angle & Rep Readout */}
            <View style={styles.metricBubble}>
              <Text style={styles.metricLabel}>
                {currentStage === 'HINGE' ? 'HÖFTVINKEL' : 'ROTATIONSVINKEL'}
              </Text>
              <Text style={styles.metricValue}>{currentAngle}°</Text>
              {currentStage === 'HINGE' && (
                <Text style={styles.metricSub}>Knävinkel: {kneeAngle}° (Optimal: 150–165°)</Text>
              )}
            </View>

            {/* Rep Counter Badge */}
            {currentStage === 'HINGE' && (
              <View style={styles.repBadge}>
                <Text style={styles.repText}>REP {repCount} / 3</Text>
              </View>
            )}

            {/* Audio Coach Cue Toast */}
            <View style={styles.cueToast}>
              <Text style={styles.cueIcon}>🎙️</Text>
              <Text style={styles.cueText}>{lastCue}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <Pressable
          style={[styles.simButton, isSimulating && styles.simButtonActive]}
          onPress={runSimulation}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <ActivityIndicator color="#09090B" size="small" />
          ) : (
            <Text style={styles.simButtonText}>
              ▶ Simulera rörelse (Demo)
            </Text>
          )}
        </Pressable>

        <Text style={styles.simHelpText}>
          Tips: Klicka på 'Simulera rörelse' för att köra en verifierad biomekanisk sekvens utan att ställa upp kameran.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#18181B',
  },
  cancelButtonText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  stageIndicator: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40,
  },
  stageTitle: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  viewfinder: {
    flex: 1,
    backgroundColor: '#121216',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeOverlay: {
    flex: 1,
    width: '100%',
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricBubble: {
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginTop: 20,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#F4F4F5',
  },
  metricSub: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 4,
  },
  repBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
  },
  repText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  cueToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
    maxWidth: '90%',
  },
  cueIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  cueText: {
    fontSize: 14,
    color: '#F4F4F5',
    fontWeight: '600',
  },
  transitionBox: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  transitionCheck: {
    fontSize: 36,
    color: '#10B981',
    fontWeight: '900',
    marginBottom: 10,
  },
  transitionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F4F4F5',
    marginBottom: 8,
  },
  transitionDesc: {
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  continueButtonText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomControls: {
    backgroundColor: '#0A0A0C',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  simButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  simButtonActive: {
    backgroundColor: '#059669',
  },
  simButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
  simHelpText: {
    fontSize: 11,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
