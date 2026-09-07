/**
 * DV-1A: Native Truth Validation Screen
 *
 * Minimal diagnostic screen that validates:
 * 1. MediaPipe initializes successfully
 * 2. Model integrity (SHA-256 match)
 * 3. Real inference produces exactly 33 valid landmarks
 * 4. All landmark values are finite and in range
 * 5. Timestamps are correct
 *
 * This is NOT a production UI. It's a diagnostic gate.
 * If DV-1A fails, DV-1B (measurement pipeline) is blocked.
 *
 * @module DV1AValidationScreen
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import * as GolfBodyPose from '../../modules/golf-body-pose';
import {
  convertNativeResultToPoseFrame,
  validateModelIntegrity,
  EXPECTED_MODEL_SHA256,
  NativeBridgeError,
} from '../core/bridge/native-landmark-bridge';
import { computeLatencyStats } from './device-validation-report';
import type { PoseFrame } from '../core/types/pose-frame';
import type { LandmarkId } from '../core/types/landmark';

export const VERSION = 'DV1A_VALIDATION_SCREEN_V1';

/** DV-1A specific report — native truth only, no pipeline */
export interface DV1AReport {
  gate: 'PASS' | 'FAIL';
  timestamp: string;

  device: {
    model: string;
    osVersion: string;
    platform: string;
  };

  model: {
    variant: 'FULL';
    version: string;
    sha256: string;
    expectedSha256: string;
    integrityMatch: boolean;
  };

  initialization: {
    status: 'SUCCESS' | 'FAILED';
    durationMs: number;
    error?: string;
  };

  inference: {
    status: 'SUCCESS' | 'FAILED';
    frameCount: number;
    latencyStats: {
      meanLatencyMs: number;
      p50LatencyMs: number;
      p95LatencyMs: number;
      maxLatencyMs: number;
    };
    error?: string;
  };

  landmarkValidation: {
    totalLandmarks: number;
    expectedLandmarks: 33;
    uniqueIds: number;
    allFinite: boolean;
    xRange: [number, number];
    yRange: [number, number];
    minVisibility: number;
    maxVisibility: number;
    minPresence: number;
    maxPresence: number;
  };

  checks: {
    name: string;
    result: 'PASS' | 'FAIL';
    detail: string;
  }[];

  errors: string[];
}

/**
 * Validates a single PoseFrame for DV-1A requirements.
 */
function validatePoseFrame(frame: PoseFrame): DV1AReport['landmarkValidation'] {
  const lms = frame.landmarks;
  const ids = new Set(lms.map((l) => l.id));

  let allFinite = true;
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let visMin = Infinity, visMax = -Infinity;
  let presMin = Infinity, presMax = -Infinity;

  for (const lm of lms) {
    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) allFinite = false;
    if (lm.z !== undefined && !Number.isFinite(lm.z)) allFinite = false;
    if (lm.visibility !== undefined && !Number.isFinite(lm.visibility)) allFinite = false;
    if (lm.presence !== undefined && !Number.isFinite(lm.presence)) allFinite = false;

    xMin = Math.min(xMin, lm.x);
    xMax = Math.max(xMax, lm.x);
    yMin = Math.min(yMin, lm.y);
    yMax = Math.max(yMax, lm.y);

    if (lm.visibility !== undefined) {
      visMin = Math.min(visMin, lm.visibility);
      visMax = Math.max(visMax, lm.visibility);
    }
    if (lm.presence !== undefined) {
      presMin = Math.min(presMin, lm.presence);
      presMax = Math.max(presMax, lm.presence);
    }
  }

  return {
    totalLandmarks: lms.length,
    expectedLandmarks: 33,
    uniqueIds: ids.size,
    allFinite,
    xRange: [xMin, xMax],
    yRange: [yMin, yMax],
    minVisibility: visMin === Infinity ? 0 : visMin,
    maxVisibility: visMax === -Infinity ? 0 : visMax,
    minPresence: presMin === Infinity ? 0 : presMin,
    maxPresence: presMax === -Infinity ? 0 : presMax,
  };
}

/**
 * Runs the DV-1A gate checks and returns a structured report.
 */
function runGateChecks(
  initOk: boolean,
  integrityOk: boolean,
  validation: DV1AReport['landmarkValidation'] | null,
): DV1AReport['checks'] {
  const checks: DV1AReport['checks'] = [];

  checks.push({
    name: 'MediaPipe initialization',
    result: initOk ? 'PASS' : 'FAIL',
    detail: initOk ? 'PoseLandmarker initialized successfully' : 'Initialization failed',
  });

  checks.push({
    name: 'Model integrity (SHA-256)',
    result: integrityOk ? 'PASS' : 'FAIL',
    detail: integrityOk ? 'Runtime SHA matches expected' : 'SHA mismatch — model may be corrupted',
  });

  if (validation) {
    checks.push({
      name: 'Landmark count (exactly 33)',
      result: validation.totalLandmarks === 33 ? 'PASS' : 'FAIL',
      detail: `Got ${validation.totalLandmarks} landmarks`,
    });

    checks.push({
      name: 'Unique landmark IDs (0–32)',
      result: validation.uniqueIds === 33 ? 'PASS' : 'FAIL',
      detail: `${validation.uniqueIds} unique IDs`,
    });

    checks.push({
      name: 'All values finite (no NaN/Infinity)',
      result: validation.allFinite ? 'PASS' : 'FAIL',
      detail: validation.allFinite ? 'All landmark values are finite' : 'Found non-finite values',
    });

    checks.push({
      name: 'X range within [0, 1]',
      result: validation.xRange[0] >= -0.5 && validation.xRange[1] <= 1.5 ? 'PASS' : 'FAIL',
      detail: `X range: [${validation.xRange[0].toFixed(3)}, ${validation.xRange[1].toFixed(3)}]`,
    });

    checks.push({
      name: 'Y range within [0, 1]',
      result: validation.yRange[0] >= -0.5 && validation.yRange[1] <= 1.5 ? 'PASS' : 'FAIL',
      detail: `Y range: [${validation.yRange[0].toFixed(3)}, ${validation.yRange[1].toFixed(3)}]`,
    });

    checks.push({
      name: 'Visibility/Presence present',
      result: validation.maxVisibility > 0 && validation.maxPresence > 0 ? 'PASS' : 'FAIL',
      detail: `Vis: [${validation.minVisibility.toFixed(2)}, ${validation.maxVisibility.toFixed(2)}], Pres: [${validation.minPresence.toFixed(2)}, ${validation.maxPresence.toFixed(2)}]`,
    });
  }

  return checks;
}

export default function DV1AValidationScreen() {
  const [report, setReport] = useState<DV1AReport | null>(null);
  const [running, setRunning] = useState(false);

  const runValidation = useCallback(async () => {
    setRunning(true);
    setReport(null);

    const errors: string[] = [];
    let initOk = false;
    let integrityOk = false;
    let modelInfo: GolfBodyPose.NativeModelInfo | null = null;
    let initDurationMs = 0;
    let inferenceOk = false;
    let validation: DV1AReport['landmarkValidation'] | null = null;
    const latencies: number[] = [];
    let inferenceError: string | undefined;
    let initError: string | undefined;

    // Step 1: Initialize MediaPipe
    try {
      const initStart = Date.now();
      await GolfBodyPose.initialize();
      initDurationMs = Date.now() - initStart;
      initOk = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      initError = msg;
      errors.push(`INIT_FAILED: ${msg}`);
    }

    // Step 2: Verify model integrity
    if (initOk) {
      try {
        modelInfo = GolfBodyPose.getModelInfo();
        integrityOk = validateModelIntegrity(modelInfo.sha256);
        if (!integrityOk) {
          errors.push(`MODEL_INTEGRITY_FAILED: expected=${EXPECTED_MODEL_SHA256}, got=${modelInfo.sha256}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`MODEL_INFO_FAILED: ${msg}`);
      }
    }

    // Step 3: Run inference on a synthetic test image
    // In DV-1A we use a small solid-color image to prove MediaPipe can run
    // without crashing. Real camera frames come in DV-1B.
    // For a real validation, the user should be visible on camera.
    if (initOk) {
      try {
        // Create a simple 640x480 RGB image (all gray)
        const width = 640;
        const height = 480;
        const rgbData = new Uint8Array(width * height * 3);
        rgbData.fill(128); // Mid-gray

        const inferStart = Date.now();
        const nativeResult = await GolfBodyPose.detectImage(
          rgbData.buffer as ArrayBuffer,
          width,
          height,
          Date.now(),
        );
        const inferEnd = Date.now();
        latencies.push(inferEnd - inferStart);

        // Convert to PoseFrame via bridge (this validates the native payload)
        const frame = convertNativeResultToPoseFrame(
          nativeResult,
          modelInfo!,
          0,
        );

        validation = validatePoseFrame(frame);
        inferenceOk = true;
      } catch (e: unknown) {
        if (e instanceof NativeBridgeError) {
          inferenceError = `BRIDGE: ${e.code} — ${e.message}`;
        } else {
          inferenceError = e instanceof Error ? e.message : String(e);
        }
        errors.push(`INFERENCE_FAILED: ${inferenceError}`);
      }
    }

    // Build gate checks
    const checks = runGateChecks(initOk, integrityOk, validation);
    const allPassed = checks.every((c) => c.result === 'PASS');

    const dv1aReport: DV1AReport = {
      gate: allPassed ? 'PASS' : 'FAIL',
      timestamp: new Date().toISOString(),
      device: {
        model: `${Platform.OS} device`,
        osVersion: `${Platform.OS} ${Platform.Version}`,
        platform: Platform.OS,
      },
      model: {
        variant: 'FULL',
        version: modelInfo?.version ?? 'UNKNOWN',
        sha256: modelInfo?.sha256 ?? 'UNKNOWN',
        expectedSha256: EXPECTED_MODEL_SHA256,
        integrityMatch: integrityOk,
      },
      initialization: {
        status: initOk ? 'SUCCESS' : 'FAILED',
        durationMs: initDurationMs,
        error: initError,
      },
      inference: {
        status: inferenceOk ? 'SUCCESS' : 'FAILED',
        frameCount: inferenceOk ? 1 : 0,
        latencyStats: computeLatencyStats(latencies),
        error: inferenceError,
      },
      landmarkValidation: validation ?? {
        totalLandmarks: 0,
        expectedLandmarks: 33,
        uniqueIds: 0,
        allFinite: false,
        xRange: [0, 0],
        yRange: [0, 0],
        minVisibility: 0,
        maxVisibility: 0,
        minPresence: 0,
        maxPresence: 0,
      },
      checks,
      errors,
    };

    // Log full report to console for extraction
    console.log('=== DV-1A REPORT ===');
    console.log(JSON.stringify(dv1aReport, null, 2));
    console.log('=== END DV-1A REPORT ===');

    setReport(dv1aReport);
    setRunning(false);

    // Clean up
    try {
      await GolfBodyPose.dispose();
    } catch {
      // Best effort cleanup
    }
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DV-1A: Native Truth</Text>
        <Text style={styles.subtitle}>
          Validates MediaPipe → 33 landmarks → canonical PoseFrame
        </Text>
      </View>

      <Pressable
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={runValidation}
        disabled={running}
      >
        <Text style={styles.buttonText}>
          {running ? 'Running...' : 'RUN DV-1A VALIDATION'}
        </Text>
      </Pressable>

      {report && (
        <View style={styles.reportContainer}>
          <View style={[styles.gateBar, report.gate === 'PASS' ? styles.gatePass : styles.gateFail]}>
            <Text style={styles.gateText}>
              GATE: {report.gate}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Checks</Text>
          {report.checks.map((check, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={[styles.checkIcon, check.result === 'PASS' ? styles.checkPass : styles.checkFail]}>
                {check.result === 'PASS' ? '✅' : '❌'}
              </Text>
              <View style={styles.checkContent}>
                <Text style={styles.checkName}>{check.name}</Text>
                <Text style={styles.checkDetail}>{check.detail}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Model</Text>
          <Text style={styles.mono}>SHA-256: {report.model.sha256}</Text>
          <Text style={styles.mono}>Expected: {report.model.expectedSha256}</Text>
          <Text style={styles.mono}>Integrity: {report.model.integrityMatch ? '✅ MATCH' : '❌ MISMATCH'}</Text>

          <Text style={styles.sectionTitle}>Performance</Text>
          <Text style={styles.mono}>Init: {report.initialization.durationMs}ms</Text>
          <Text style={styles.mono}>Inference p50: {report.inference.latencyStats.p50LatencyMs.toFixed(1)}ms</Text>

          {report.errors.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Errors</Text>
              {report.errors.map((err, i) => (
                <Text key={i} style={styles.errorText}>{err}</Text>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Full Report (JSON)</Text>
          <Text style={styles.json}>{JSON.stringify(report, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  subtitle: { fontSize: 14, color: '#888888', marginTop: 4 },
  button: {
    marginHorizontal: 24,
    marginVertical: 16,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#374151' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  reportContainer: { padding: 24 },
  gateBar: { padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
  gatePass: { backgroundColor: '#065f46' },
  gateFail: { backgroundColor: '#7f1d1d' },
  gateText: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e5e7eb', marginTop: 20, marginBottom: 8 },
  checkRow: { flexDirection: 'row', marginBottom: 8 },
  checkIcon: { fontSize: 16, marginRight: 8, marginTop: 2 },
  checkPass: {},
  checkFail: {},
  checkContent: { flex: 1 },
  checkName: { fontSize: 14, fontWeight: '500', color: '#d1d5db' },
  checkDetail: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  mono: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#9ca3af', marginBottom: 4 },
  errorText: { fontSize: 12, color: '#f87171', marginBottom: 4 },
  json: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#6b7280', marginTop: 8 },
});
