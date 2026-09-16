/**
 * ScreeningResultScreen — The Causal Body-Swing Bridge
 *
 * Displays the complete Golf Body Score, detailed joint angles, and maps
 * physical limitations directly to predicted golf swing faults (The USP).
 *
 * @module ScreeningResultScreen
 * @version SCREENING_RESULT_SCREEN_V1
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useScreening } from '../../context/ScreeningContext';

export default function ScreeningResultScreen() {
  const { currentResult, setActiveTab, cancelScreening } = useScreening();

  if (!currentResult) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Inget resultat tillgängligt</Text>
        <Pressable style={styles.primaryButton} onPress={() => setActiveTab('DASHBOARD')}>
          <Text style={styles.primaryButtonText}>Tillbaka till Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const {
    golfBodyScore,
    tierLabel,
    tierColor,
    subScores,
    angles,
    predictedSwingFaults,
    prescribedExercises,
    isSimulated
  } = currentResult;

  const handleReturnToDashboard = () => {
    cancelScreening();
    setActiveTab('DASHBOARD');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Simulation Warning Banner */}
      {isSimulated && (
        <View style={styles.simulationBanner}>
          <Text style={styles.simulationBannerText}>
            ⚠️ SIMULERAT RESULTAT — Dessa värden är genererade utan kamera och speglar inte din kropp.
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SCREENINGRESULTAT</Text>
        <Text style={styles.subtitle}>Din kropps mobilitet och dess direkta koppling till din sving.</Text>
      </View>

      {/* Hero Score Card */}
      <View style={[styles.heroCard, { borderColor: tierColor }]}>
        <Text style={styles.heroTitle}>DITT GOLF BODY SCORE</Text>

        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, { color: tierColor }]}>{golfBodyScore}</Text>
          <Text style={styles.scoreMax}>/ 100</Text>
        </View>

        <View style={[styles.tierBadge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
          <Text style={[styles.tierBadgeText, { color: tierColor }]}>
            {tierLabel.toUpperCase()}
          </Text>
        </View>

        <View style={styles.subScoresRow}>
          <View style={styles.subScoreItem}>
            <Text style={styles.subScoreLabel}>Höftfällning</Text>
            <Text style={styles.subScoreVal}>{subScores.hipHinge} / 50</Text>
          </View>
          <View style={styles.subScoreDivider} />
          <View style={styles.subScoreItem}>
            <Text style={styles.subScoreLabel}>Bröstrygg</Text>
            <Text style={styles.subScoreVal}>{subScores.thoracicRotation} / 50</Text>
          </View>
        </View>
      </View>

      {/* Biomechanical Joint Angles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Uppmätta vinklar & kinematik</Text>
        <View style={styles.anglesGrid}>
          {angles.hipHingeFlexionDeg !== undefined && (
            <View style={styles.angleCard}>
              <Text style={styles.angleLabel}>Höftfällning</Text>
              <Text style={styles.angleValue}>{angles.hipHingeFlexionDeg}°</Text>
              <Text style={styles.angleBenchmark}>Optimalt: ≤ 90°</Text>
            </View>
          )}

          {angles.hipHingeKneeDeg !== undefined && (
            <View style={styles.angleCard}>
              <Text style={styles.angleLabel}>Knävinkel</Text>
              <Text style={styles.angleValue}>{angles.hipHingeKneeDeg}°</Text>
              <Text style={styles.angleBenchmark}>Optimalt: 150–165°</Text>
            </View>
          )}

          {angles.thoracicLeftDeg !== undefined && (
            <View style={styles.angleCard}>
              <Text style={styles.angleLabel}>Rotation Vänster</Text>
              <Text style={styles.angleValue}>{angles.thoracicLeftDeg}°</Text>
              <Text style={styles.angleBenchmark}>Optimalt: ≥ 45°</Text>
            </View>
          )}

          {angles.thoracicRightDeg !== undefined && (
            <View style={styles.angleCard}>
              <Text style={styles.angleLabel}>Rotation Höger</Text>
              <Text style={styles.angleValue}>{angles.thoracicRightDeg}°</Text>
              <Text style={styles.angleBenchmark}>Optimalt: ≥ 45°</Text>
            </View>
          )}
        </View>
      </View>

      {/* The Causal Bridge — THE USP */}
      <View style={styles.section}>
        <View style={styles.bridgeHeaderBox}>
          <Text style={styles.bridgeBadge}>ORSAKSSAMBAND</Text>
          <Text style={styles.sectionTitle}>Vad betyder detta för din sving?</Text>
        </View>

        {predictedSwingFaults.map((fault, idx) => (
          <View key={idx} style={styles.faultCard}>
            <View style={styles.faultHeader}>
              <Text style={styles.faultAlertIcon}>⚠️</Text>
              <Text style={styles.faultTitle}>{fault.title}</Text>
            </View>
            <Text style={styles.faultExplanation}>{fault.explanation}</Text>

            <View style={styles.prescriptionBox}>
              <Text style={styles.prescriptionTitle}>💡 Åtgärd:</Text>
              <Text style={styles.prescriptionText}>{fault.prescription}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Prescribed Corrective Exercises */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3 Prioriterade övningar</Text>
        {prescribedExercises.map((ex, idx) => (
          <View key={idx} style={styles.exerciseCard}>
            <View style={styles.exerciseNumberBadge}>
              <Text style={styles.exerciseNumberText}>{idx + 1}</Text>
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Text style={styles.exerciseReps}>{ex.setsReps}</Text>
              <Text style={styles.exerciseDesc}>{ex.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Return to Dashboard Button */}
      <Pressable style={styles.primaryButton} onPress={handleReturnToDashboard}>
        <Text style={styles.primaryButtonText}>Gå till Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  simulationBanner: {
    backgroundColor: '#78350F',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  simulationBannerText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
    padding: 20,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 16,
    marginBottom: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 4,
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 2,
    marginBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreMax: {
    fontSize: 18,
    fontWeight: '600',
    color: '#71717A',
    marginLeft: 6,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subScoresRow: {
    flexDirection: 'row',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  subScoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  subScoreDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#27272A',
  },
  subScoreLabel: {
    fontSize: 11,
    color: '#71717A',
    marginBottom: 2,
  },
  subScoreVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4F4F5',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 12,
  },
  anglesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  angleCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#121216',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  angleLabel: {
    fontSize: 11,
    color: '#A1A1AA',
    marginBottom: 4,
  },
  angleValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F4F4F5',
    marginBottom: 2,
  },
  angleBenchmark: {
    fontSize: 10,
    color: '#71717A',
  },
  bridgeHeaderBox: {
    marginBottom: 8,
  },
  bridgeBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  faultCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 12,
  },
  faultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  faultAlertIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  faultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4F4F5',
    flex: 1,
  },
  faultExplanation: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 12,
  },
  prescriptionBox: {
    backgroundColor: '#121216',
    borderRadius: 8,
    padding: 10,
  },
  prescriptionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 2,
  },
  prescriptionText: {
    fontSize: 12,
    color: '#E4E4E7',
    lineHeight: 16,
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: '#121216',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  exerciseNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  exerciseNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 2,
  },
  exerciseReps: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseDesc: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
});
