/**
 * DashboardScreen — Main Hub for Golf Body OS
 *
 * Displays current Golf Body Score, sub-scores, primary biomechanical
 * bottleneck, and quick actions to launch physical screenings.
 *
 * @module DashboardScreen
 * @version DASHBOARD_SCREEN_V1
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useScreening } from '../../context/ScreeningContext';

export default function DashboardScreen() {
  const { latestSession, startScreening, setActiveTab } = useScreening();

  const hasSession = latestSession !== null;
  const score = hasSession ? latestSession.golfBodyScore : null;
  const tierLabel = hasSession ? latestSession.tierLabel : 'Ej testad';
  const tierColor = hasSession ? latestSession.tierColor : '#71717A';

  const hipScore = hasSession ? latestSession.subScores.hipHinge : 0;
  const rotScore = hasSession ? latestSession.subScores.thoracicRotation : 0;

  const topFault = hasSession && latestSession.predictedSwingFaults.length > 0
    ? latestSession.predictedSwingFaults[0]
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>GOLF BODY OS</Text>
        <Text style={styles.subtitle}>Kan din kropp göra den sving du vill göra?</Text>
      </View>

      {/* Main Score Hero Card */}
      <View style={[styles.heroCard, { borderColor: tierColor }]}>
        <Text style={styles.heroTitle}>GOLF BODY SCORE</Text>

        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreValue, { color: tierColor }]}>
            {score !== null ? score : '--'}
          </Text>
          <Text style={styles.scoreMax}>/ 100</Text>
        </View>

        <View style={[styles.tierBadge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
          <Text style={[styles.tierBadgeText, { color: tierColor }]}>
            {tierLabel.toUpperCase()}
          </Text>
        </View>

        {/* Sub-scores */}
        <View style={styles.subScoresRow}>
          <View style={styles.subScoreItem}>
            <Text style={styles.subScoreLabel}>Höftfällning</Text>
            <Text style={styles.subScoreValue}>
              {hasSession ? `${hipScore} / 50` : '--'}
            </Text>
          </View>
          <View style={styles.subScoreDivider} />
          <View style={styles.subScoreItem}>
            <Text style={styles.subScoreLabel}>Bröstrygg</Text>
            <Text style={styles.subScoreValue}>
              {hasSession ? `${rotScore} / 50` : '--'}
            </Text>
          </View>
        </View>
      </View>

      {/* Primary Bottleneck Card */}
      {topFault && (
        <View style={styles.bottleneckCard}>
          <View style={styles.bottleneckHeader}>
            <Text style={styles.bottleneckTag}>IDENTIFIERAD FLASKHALS</Text>
          </View>
          <Text style={styles.bottleneckTitle}>{topFault.title}</Text>
          <Text style={styles.bottleneckExplanation} numberOfLines={3}>
            {topFault.explanation}
          </Text>
          <Pressable
            style={styles.bottleneckAction}
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text style={styles.bottleneckActionText}>Visa åtgärdsplan & övningar →</Text>
          </Pressable>
        </View>
      )}

      {/* Quick Launch Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Screening & Tester</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => startScreening('FULL_BATTERY')}
        >
          <Text style={styles.primaryButtonText}>Starta full screening (4 min)</Text>
          <Text style={styles.primaryButtonSub}>Hip Hinge + Thoracic Rotation</Text>
        </Pressable>

        <View style={styles.testGrid}>
          <Pressable
            style={styles.testCard}
            onPress={() => startScreening('HIP_HINGE')}
          >
            <Text style={styles.testCardIcon}>🦵</Text>
            <Text style={styles.testCardTitle}>Höftfällning</Text>
            <Text style={styles.testCardDesc}>3 reps mot tush-linjen</Text>
          </Pressable>

          <Pressable
            style={styles.testCard}
            onPress={() => startScreening('THORACIC_ROTATION')}
          >
            <Text style={styles.testCardIcon}>🔄</Text>
            <Text style={styles.testCardTitle}>Bröstrygg</Text>
            <Text style={styles.testCardDesc}>Bilateral dissociation</Text>
          </Pressable>
        </View>
      </View>

      {/* Info Tip */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Visste du att...</Text>
        <Text style={styles.tipText}>
          Över 64% av alla amatörgolfare med Early Extension (bäckenet skjuter mot bollen vid träff)
          har en begränsning i höftfällningen snarare än ett tekniskt svingfel.
        </Text>
      </View>
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
  header: {
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 2,
    marginBottom: 12,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreMax: {
    fontSize: 20,
    fontWeight: '600',
    color: '#71717A',
    marginLeft: 6,
  },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  tierBadgeText: {
    fontSize: 12,
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
    alignSelf: 'center',
  },
  subScoreLabel: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: 4,
  },
  subScoreValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F5',
  },
  bottleneckCard: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 20,
  },
  bottleneckHeader: {
    marginBottom: 6,
  },
  bottleneckTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  bottleneckTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 6,
  },
  bottleneckExplanation: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 10,
  },
  bottleneckAction: {
    alignSelf: 'flex-start',
  },
  bottleneckActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#09090B',
  },
  primaryButtonSub: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
  },
  testGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  testCard: {
    flex: 1,
    backgroundColor: '#121216',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  testCardIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  testCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 4,
  },
  testCardDesc: {
    fontSize: 11,
    color: '#71717A',
  },
  tipCard: {
    backgroundColor: '#121216',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E4E4E7',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 18,
  },
});
