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
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useScreening } from '../../context/ScreeningContext';
import { StoredScreeningSession } from '../../storage/screening-repository';
import { AudioCoachService } from '../../core/coaching/audio-coach';
import { LiveCoachingEngine } from '../../core/coaching/live-coaching-engine';
import { LiveRotationCoachingEngine } from '../../core/coaching/live-rotation-coaching-engine';
import { calculateGolfBodyScore, getTierDetailsForScore } from '../../core/metrics/golf-body-score';
import { CoachingPhraseKey } from '../../core/coaching/i18n/locales';
import * as GolfBodyPose from '../../../modules/golf-body-pose';

export default function ActiveScreeningScreen() {
  const { activeTestType, language, cancelScreening, finishScreening } = useScreening();

  // Sub-stage within screening (e.g. for FULL_BATTERY: HINGE -> ROTATION)
  const [currentStage, setCurrentStage] = useState<'HINGE' | 'STAGE_TRANSITION' | 'ROTATION'>(
    activeTestType === 'THORACIC_ROTATION' ? 'ROTATION' : 'HINGE'
  );

  const [repCount, setRepCount] = useState<number>(0);
  const [currentAngle, setCurrentAngle] = useState<number>(180);
  const [kneeAngle, setKneeAngle] = useState<number>(170);
  const [lastCue, setLastCue] = useState<string>(
    language === 'sv-SE' ? 'Ställ dig i position för att börja' : 'Get into position to begin'
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Vision Camera & Native Pose Module State
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);
  const [nativePoseReady, setNativePoseReady] = useState<boolean>(false);

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

  // Attempt to initialize MediaPipe native module on mount
  useEffect(() => {
    let isMounted = true;
    GolfBodyPose.initialize()
      .then(() => {
        if (isMounted) setNativePoseReady(true);
      })
      .catch((err: unknown) => {
        console.warn('[ActiveScreening] MediaPipe native module unavailable:', err);
        if (isMounted) setNativePoseReady(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    isRunningRef.current = false;
    setIsSimulating(false);
  }, []);

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
      isSimulated: isSimulating,
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
        {hasPermission && device != null && !isSimulating && (
          <Pressable
            style={styles.topFlipButton}
            onPress={() => setCameraPosition(p => p === 'front' ? 'back' : 'front')}
          >
            <Text style={styles.topFlipText}>🔄 {cameraPosition === 'front' ? 'Selfie' : 'Bakre'}</Text>
          </Pressable>
        )}
      </View>

      {/* Main Viewfinder / Canvas Area */}
      <View style={styles.viewfinder}>
        {/* Live Camera Feed */}
        {hasPermission && device != null && !isSimulating && currentStage !== 'STAGE_TRANSITION' && (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
          />
        )}

        {currentStage === 'STAGE_TRANSITION' ? (
          <View style={styles.transitionBox}>
            <Text style={styles.transitionCheck}>✓</Text>
            <Text style={styles.transitionTitle}>
              {language === 'sv-SE' ? 'Höftfällning slutförd!' : 'Hip Hinge Complete!'}
            </Text>
            <Text style={styles.transitionDesc}>
              {language === 'sv-SE'
                ? 'Vänd dig nu mot kameran squarely med armarna korsade över bröstkorgen.'
                : 'Now face the camera squarely with your arms crossed over your chest.'}
            </Text>
            <Pressable style={styles.continueButton} onPress={proceedToRotation}>
              <Text style={styles.continueButtonText}>
                {language === 'sv-SE' ? 'Fortsätt till bröstryggstest →' : 'Continue to Thoracic Test →'}
              </Text>
            </Pressable>
          </View>
        ) : !hasPermission && !isSimulating ? (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>📷</Text>
            <Text style={styles.permissionTitle}>
              {language === 'sv-SE' ? 'Kameratillstånd krävs' : 'Camera Permission Required'}
            </Text>
            <Text style={styles.permissionDesc}>
              {language === 'sv-SE'
                ? 'Golf Body OS använder kameran för att spåra dina ledpositioner och beräkna biomekaniska vinklar i realtid.'
                : 'Golf Body OS uses the camera to track your joint positions and compute biomechanical angles in real-time.'}
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>
                {language === 'sv-SE' ? 'Aktivera kamera' : 'Enable Camera'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.permissionSecondaryButton}
              onPress={runSimulation}
            >
              <Text style={styles.permissionSecondaryText}>
                {language === 'sv-SE' ? 'Kör med rörelsesimulering istället (Demo) →' : 'Use movement simulation instead (Demo) →'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.activeOverlay}>
            {/* Camera Status Badge */}
            <View style={styles.feedStatusRow}>
              <View style={[styles.statusBadge, isSimulating ? styles.statusBadgeSim : styles.statusBadgeLive]}>
                <Text style={styles.statusBadgeText}>
                  {isSimulating
                    ? '⚡ SIMULERING (DEMO)'
                    : `🟢 LIVE KAMERA (${cameraPosition === 'front' ? 'SELFIE' : 'BAKRE'})`}
                </Text>
              </View>
            </View>

            {/* Live Angle & Rep Readout */}
            <View style={styles.metricBubble}>
              <Text style={styles.metricLabel}>
                {currentStage === 'HINGE'
                  ? (language === 'sv-SE' ? 'HÖFTVINKEL' : 'HIP HINGE ANGLE')
                  : (language === 'sv-SE' ? 'ROTATIONSVINKEL' : 'ROTATION ANGLE')}
              </Text>
              <Text style={styles.metricValue}>{currentAngle}°</Text>
              {currentStage === 'HINGE' && (
                <Text style={styles.metricSub}>
                  {language === 'sv-SE'
                    ? `Knävinkel: ${kneeAngle}° (Optimal: 150–165°)`
                    : `Knee Angle: ${kneeAngle}° (Target: 150–165°)`}
                </Text>
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
        {isSimulating ? (
          <Pressable style={styles.stopSimButton} onPress={stopSimulation}>
            <Text style={styles.stopSimButtonText}>
              {language === 'sv-SE' ? '⏹ Avbryt simulering' : '⏹ Stop Simulation'}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={styles.simButton} onPress={runSimulation}>
            <Text style={styles.simButtonText}>
              {language === 'sv-SE' ? '▶ Starta rörelsesimulering (Demo)' : '▶ Run Movement Simulation (Demo)'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.simHelpText}>
          {hasPermission && device != null
            ? (language === 'sv-SE'
                ? 'Kameran är aktiv och analyserar i realtid. Du kan när som helst testa simuleringsläget för snabbdemo.'
                : 'Camera is active and analyzing in real-time. You can toggle simulation mode at any time for quick demo.')
            : (language === 'sv-SE'
                ? 'Tips: Tillåt kameran ovan för skarp screening, eller starta rörelsesimulering för att testa flödet.'
                : 'Tip: Allow camera access above for live screening, or run simulation to test the flow.')}
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
  },
  stageTitle: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topFlipButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  topFlipText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  viewfinder: {
    flex: 1,
    backgroundColor: '#121216',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  activeOverlay: {
    flex: 1,
    width: '100%',
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedStatusRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusBadgeSim: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: 0.5,
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
  permissionCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  permissionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F4F4F5',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  permissionSecondaryButton: {
    paddingVertical: 8,
  },
  permissionSecondaryText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
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
  simButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
  stopSimButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopSimButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  simHelpText: {
    fontSize: 11,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
