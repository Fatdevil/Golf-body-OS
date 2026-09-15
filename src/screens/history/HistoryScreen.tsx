/**
 * HistoryScreen — Screening Session Progression
 *
 * Displays chronological history of past physical screenings,
 * track records over time, and progression metrics.
 *
 * @module HistoryScreen
 * @version HISTORY_SCREEN_V1
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useScreening } from '../../context/ScreeningContext';
import { StoredScreeningSession } from '../../storage/screening-repository';

export default function HistoryScreen() {
  const { sessions, clearHistory, startScreening, setCurrentResult, setActiveScreeningStep, setActiveTab } = useScreening();

  const handleOpenSession = (session: StoredScreeningSession) => {
    setCurrentResult(session);
    setActiveScreeningStep('RESULT');
    setActiveTab('SCREENING');
  };

  const formatDate = (timestampMs: number): string => {
    const d = new Date(timestampMs);
    return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getTestLabel = (type: string): string => {
    switch (type) {
      case 'FULL_BATTERY':
        return 'Full Screening';
      case 'HIP_HINGE':
        return 'Höftfällning';
      case 'THORACIC_ROTATION':
        return 'Bröstrygg';
      default:
        return type;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>HISTORIK & PROGRESSION</Text>
          {sessions.length > 0 && (
            <Pressable onPress={clearHistory} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Rensa</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          Se hur din rörlighet och dina förutsättningar förändras över tid.
        </Text>
      </View>

      {/* Empty State */}
      {sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>Inga sparade screeningar</Text>
          <Text style={styles.emptyText}>
            När du genomför en screening sparas dina vinklar, poäng och svingfelsrekommendationer här automatiskt.
          </Text>
          <Pressable
            style={styles.startButton}
            onPress={() => startScreening('FULL_BATTERY')}
          >
            <Text style={styles.startButtonText}>Starta din första screening</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sessionList}>
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              style={[styles.sessionCard, { borderLeftColor: session.tierColor }]}
              onPress={() => handleOpenSession(session)}
            >
              <View style={styles.sessionMain}>
                <View style={styles.sessionHeaderRow}>
                  <View style={styles.testBadge}>
                    <Text style={styles.testBadgeText}>{getTestLabel(session.testType)}</Text>
                  </View>
                  <Text style={styles.sessionDate}>{formatDate(session.timestampMs)}</Text>
                </View>

                <View style={styles.sessionBodyRow}>
                  <View style={styles.scoreBox}>
                    <Text style={[styles.sessionScore, { color: session.tierColor }]}>
                      {session.golfBodyScore}
                    </Text>
                    <Text style={styles.sessionScoreMax}>/100</Text>
                  </View>

                  <View style={styles.metricsSummary}>
                    {session.angles.hipHingeFlexionDeg !== undefined && (
                      <Text style={styles.metricItem}>
                        Höftvinkel: <Text style={styles.metricItemVal}>{session.angles.hipHingeFlexionDeg}°</Text>
                      </Text>
                    )}
                    {session.angles.thoracicLeftDeg !== undefined && (
                      <Text style={styles.metricItem}>
                        Vänster/Höger: <Text style={styles.metricItemVal}>{session.angles.thoracicLeftDeg}° / {session.angles.thoracicRightDeg}°</Text>
                      </Text>
                    )}
                    {session.predictedSwingFaults.length > 0 && session.predictedSwingFaults[0] && (
                      <Text style={styles.faultTag} numberOfLines={1}>
                        ⚠️ {session.predictedSwingFaults[0].title}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: 1.5,
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#18181B',
  },
  clearButtonText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  startButtonText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121216',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    borderLeftWidth: 5,
  },
  sessionMain: {
    flex: 1,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  testBadge: {
    backgroundColor: '#18181B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  testBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  sessionDate: {
    fontSize: 11,
    color: '#71717A',
  },
  sessionBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 16,
  },
  sessionScore: {
    fontSize: 32,
    fontWeight: '900',
  },
  sessionScoreMax: {
    fontSize: 13,
    color: '#71717A',
    marginLeft: 2,
  },
  metricsSummary: {
    flex: 1,
  },
  metricItem: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 2,
  },
  metricItemVal: {
    fontWeight: '700',
    color: '#F4F4F5',
  },
  faultTag: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#71717A',
    marginLeft: 12,
  },
});
