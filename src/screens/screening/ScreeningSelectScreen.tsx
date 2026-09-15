/**
 * ScreeningSelectScreen — Protocol Selection
 *
 * Allows the golfer to select between Full Battery (Hip Hinge + Thoracic Rotation)
 * or individual component mobility screenings.
 *
 * @module ScreeningSelectScreen
 * @version SCREENING_SELECT_SCREEN_V1
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useScreening } from '../../context/ScreeningContext';
import { ScreeningTestType } from '../../storage/screening-repository';

export default function ScreeningSelectScreen() {
  const { startScreening } = useScreening();

  const handleSelect = (testType: ScreeningTestType) => {
    startScreening(testType);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>VÄLJ SCREENING</Text>
        <Text style={styles.subtitle}>
          Testa din kropps mobilitet och separation för att upptäcka vad som begränsar din sving.
        </Text>
      </View>

      {/* Option 1: Full Battery (Recommended) */}
      <Pressable
        style={[styles.card, styles.cardFeatured]}
        onPress={() => handleSelect('FULL_BATTERY')}
      >
        <View style={styles.badgeFeatured}>
          <Text style={styles.badgeFeaturedText}>REKOMMENDERAT</Text>
        </View>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🏌️‍♂️</Text>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>Full Kroppsscreening</Text>
            <Text style={styles.cardTime}>~4 minuter • 2 deltester</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>
          Kombinerar Hip Hinge och Thoracic Rotation för att ge ditt officiella Golf Body Score (0–100) och komplett svingfelsförutsägelse.
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardActionFeatured}>Starta full screening →</Text>
        </View>
      </Pressable>

      {/* Option 2: Hip Hinge */}
      <Pressable
        style={styles.card}
        onPress={() => handleSelect('HIP_HINGE')}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🦵</Text>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>Höftfällning (Hip Hinge)</Text>
            <Text style={styles.cardTime}>~2 minuter • 3 repetitioner</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>
          Mäter din förmåga att fälla från höften med neutral ryggrad. Avslöjar risk för Early Extension och Loss of Posture i träffen.
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAction}>Starta höftfällning →</Text>
        </View>
      </Pressable>

      {/* Option 3: Thoracic Rotation */}
      <Pressable
        style={styles.card}
        onPress={() => handleSelect('THORACIC_ROTATION')}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🔄</Text>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>Bröstrygg (Thoracic Rotation)</Text>
            <Text style={styles.cardTime}>~2 minuter • Bilateralt</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>
          Mäter isolerad bröstryggsrotation med stillastående bäcken. Avslöjar asymmetri, Reverse Spine Angle och överrotation.
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAction}>Starta bröstryggstest →</Text>
        </View>
      </Pressable>

      {/* Instructions Card */}
      <View style={styles.prepCard}>
        <Text style={styles.prepTitle}>📋 Förberedelser inför testet</Text>
        <Text style={styles.prepItem}>1. Placera mobilen i brösthöjd 2.5–3 meter bort.</Text>
        <Text style={styles.prepItem}>2. Se till att hela kroppen (fötter till huvud) syns i kameran.</Text>
        <Text style={styles.prepItem}>3. Ha ljudet påslaget — röstcoachen guidar dig genom varje rep.</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#121216',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  cardFeatured: {
    borderColor: '#10B981',
    backgroundColor: '#0F1A15',
    borderWidth: 1.5,
  },
  badgeFeatured: {
    backgroundColor: '#10B981',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeFeaturedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#09090B',
    letterSpacing: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F5',
  },
  cardTime: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 10,
  },
  cardAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  cardActionFeatured: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
  },
  prepCard: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  prepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E4E4E7',
    marginBottom: 8,
  },
  prepItem: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 4,
  },
});
