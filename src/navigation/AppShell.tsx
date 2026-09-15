/**
 * AppShell — Main Application Container & Navigation Shell
 *
 * Provides a responsive dark mode layout with tab-based navigation
 * (Hem, Testa, Historik) and direct access to DV-1A diagnostics.
 *
 * @module AppShell
 * @version APP_SHELL_V1
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, StatusBar } from 'react-native';
import { useScreening, AppTab } from '../context/ScreeningContext';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ScreeningSelectScreen from '../screens/screening/ScreeningSelectScreen';
import ActiveScreeningScreen from '../screens/screening/ActiveScreeningScreen';
import ScreeningResultScreen from '../screens/screening/ScreeningResultScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import DV1AValidationScreen from '../validation/DV1AValidationScreen';

export default function AppShell() {
  const { activeTab, setActiveTab, activeScreeningStep, setActiveScreeningStep } = useScreening();

  const handleTabPress = (tab: AppTab) => {
    if (tab === 'SCREENING' && activeScreeningStep === 'RESULT') {
      setActiveScreeningStep('SELECT');
    }
    setActiveTab(tab);
  };

  const renderCurrentScreen = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <DashboardScreen />;
      case 'SCREENING':
        switch (activeScreeningStep) {
          case 'SELECT':
            return <ScreeningSelectScreen />;
          case 'RUNNER':
            return <ActiveScreeningScreen />;
          case 'RESULT':
            return <ScreeningResultScreen />;
          default:
            return <ScreeningSelectScreen />;
        }
      case 'HISTORY':
        return <HistoryScreen />;
      case 'DIAGNOSTICS':
        return (
          <View style={styles.diagContainer}>
            <View style={styles.diagHeader}>
              <Pressable
                style={styles.diagBackButton}
                onPress={() => setActiveTab('DASHBOARD')}
              >
                <Text style={styles.diagBackText}>← Tillbaka till appen</Text>
              </Pressable>
              <Text style={styles.diagTitle}>NATIVE TRUTH GATE (DV-1A)</Text>
            </View>
            <DV1AValidationScreen />
          </View>
        );
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0C" />

      {/* Top App Header */}
      {activeTab !== 'DIAGNOSTICS' && (
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={styles.statusDot} />
            <Text style={styles.brandTitle}>GOLF BODY OS</Text>
          </View>
          <Pressable
            style={styles.diagTrigger}
            onPress={() => setActiveTab('DIAGNOSTICS')}
          >
            <Text style={styles.diagTriggerText}>⚙ DV-1A</Text>
          </Pressable>
        </View>
      )}

      {/* Screen Body */}
      <View style={styles.screenBody}>
        {renderCurrentScreen()}
      </View>

      {/* Bottom Navigation TabBar */}
      {activeTab !== 'DIAGNOSTICS' && activeScreeningStep !== 'RUNNER' && (
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, activeTab === 'DASHBOARD' && styles.tabItemActive]}
            onPress={() => handleTabPress('DASHBOARD')}
          >
            <Text style={styles.tabIcon}>🏠</Text>
            <Text style={[styles.tabLabel, activeTab === 'DASHBOARD' && styles.tabLabelActive]}>
              Hem
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeTab === 'SCREENING' && styles.tabItemActive]}
            onPress={() => handleTabPress('SCREENING')}
          >
            <Text style={styles.tabIcon}>🧪</Text>
            <Text style={[styles.tabLabel, activeTab === 'SCREENING' && styles.tabLabelActive]}>
              Testa
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
            onPress={() => handleTabPress('HISTORY')}
          >
            <Text style={styles.tabIcon}>📈</Text>
            <Text style={[styles.tabLabel, activeTab === 'HISTORY' && styles.tabLabelActive]}>
              Historik
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
    backgroundColor: '#0A0A0C',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F4F4F5',
    letterSpacing: 2,
  },
  diagTrigger: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  diagTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
  },
  screenBody: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0D10',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingVertical: 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#18181B',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  tabLabelActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  diagContainer: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#18181B',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  diagBackButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#27272A',
    marginRight: 12,
  },
  diagBackText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  diagTitle: {
    color: '#F4F4F5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
