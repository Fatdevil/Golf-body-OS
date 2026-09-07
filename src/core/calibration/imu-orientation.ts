/**
 * IMU Orientation Module — Device pitch, roll, and stability.
 *
 * Uses expo-sensors (Accelerometer + Gyroscope) to determine
 * phone orientation and stability for camera setup validation.
 *
 * IMPORTANT (Correction #5): No yaw measurement.
 * Absolute yaw cannot be determined from accelerometer + gyro alone
 * (drifts without magnetometer/external reference). We don't need
 * yaw for R-1A camera setup validation.
 *
 * @module imu-orientation
 * @version IMU_ORIENTATION_V1
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';

export const VERSION = 'IMU_ORIENTATION_V1';

/** 3D vector */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Device orientation derived from IMU sensors.
 * No yaw — only pitch and roll are reliably determinable.
 */
export interface DeviceOrientation {
  /** Forward/backward tilt in degrees. 0° = phone vertical. */
  pitch: number;
  /** Left/right tilt in degrees. 0° = phone upright. */
  roll: number;
  /** True if device movement is below threshold for ≥ stabilityWindowMs. */
  isStable: boolean;
  /** Normalized gravity direction vector from accelerometer. */
  gravityVector: Vector3;
}

/** Result of a calibration check */
export interface CalibrationResult {
  /** Total phone tilt from vertical in degrees */
  phoneTiltDegrees: number;
  /** True if tilt < maxTiltDegrees */
  isLevelEnough: boolean;
  /** True if stable for stabilityWindowMs */
  isStableEnough: boolean;
  /** ISO timestamp */
  timestamp: string;
}

/** Configuration for IMU monitoring */
export interface IMUConfig {
  /** Sampling rate in Hz (default: 60) */
  samplingRateHz: number;
  /** Window to assess stability in ms (default: 1000) */
  stabilityWindowMs: number;
  /** Maximum angular movement (°/s) to be considered stable (default: 2.0) */
  stabilityThresholdDegPerSec: number;
  /** Maximum acceptable tilt from vertical in degrees (default: 10) */
  maxTiltDegrees: number;
}

export const DEFAULT_IMU_CONFIG: IMUConfig = {
  samplingRateHz: 60,
  stabilityWindowMs: 1000,
  stabilityThresholdDegPerSec: 2.0,
  maxTiltDegrees: 10,
};

/**
 * Monitors device orientation and stability using accelerometer and gyroscope.
 *
 * Usage:
 * ```typescript
 * const monitor = new IMUOrientationMonitor();
 * await monitor.start();
 * const orientation = monitor.getCurrentOrientation();
 * const calibration = monitor.checkCalibration();
 * await monitor.stop();
 * ```
 */
export class IMUOrientationMonitor {
  private config: IMUConfig;
  private accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

  private currentGravity: Vector3 = { x: 0, y: -1, z: 0 };
  private gyroHistory: Array<{ timestamp: number; magnitude: number }> = [];

  // Complementary filter state
  private pitch = 0;
  private roll = 0;
  private lastTimestamp = 0;
  private readonly ALPHA = 0.98; // Gyro weight in complementary filter

  constructor(config: Partial<IMUConfig> = {}) {
    this.config = { ...DEFAULT_IMU_CONFIG, ...config };
  }

  /** Start listening to accelerometer and gyroscope sensors. */
  async start(): Promise<void> {
    const updateIntervalMs = Math.round(1000 / this.config.samplingRateHz);

    await Accelerometer.setUpdateInterval(updateIntervalMs);
    await Gyroscope.setUpdateInterval(updateIntervalMs);

    this.accelSubscription = Accelerometer.addListener((data) => {
      this.onAccelerometerUpdate(data);
    });

    this.gyroSubscription = Gyroscope.addListener((data) => {
      this.onGyroscopeUpdate(data);
    });

    this.lastTimestamp = Date.now();
  }

  /** Stop listening to sensors and release resources. */
  async stop(): Promise<void> {
    this.accelSubscription?.remove();
    this.gyroSubscription?.remove();
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.gyroHistory = [];
  }

  /** Get current device orientation. */
  getCurrentOrientation(): DeviceOrientation {
    return {
      pitch: this.pitch,
      roll: this.roll,
      isStable: this.isStable(),
      gravityVector: { ...this.currentGravity },
    };
  }

  /** Check if the device meets calibration requirements. */
  checkCalibration(): CalibrationResult {
    const tilt = Math.sqrt(this.pitch * this.pitch + this.roll * this.roll);
    return {
      phoneTiltDegrees: tilt,
      isLevelEnough: tilt < this.config.maxTiltDegrees,
      isStableEnough: this.isStable(),
      timestamp: new Date().toISOString(),
    };
  }

  // ---- Private ----

  private onAccelerometerUpdate(data: { x: number; y: number; z: number }): void {
    // Normalize gravity vector
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    if (magnitude > 0.01) {
      this.currentGravity = {
        x: data.x / magnitude,
        y: data.y / magnitude,
        z: data.z / magnitude,
      };
    }

    // Calculate pitch and roll from accelerometer (absolute reference)
    const accelPitch = Math.atan2(data.x, Math.sqrt(data.y ** 2 + data.z ** 2)) * (180 / Math.PI);
    const accelRoll = Math.atan2(data.y, Math.sqrt(data.x ** 2 + data.z ** 2)) * (180 / Math.PI);

    // Complementary filter: blend gyro (fast, drifts) with accel (noisy, absolute)
    this.pitch = this.ALPHA * this.pitch + (1 - this.ALPHA) * accelPitch;
    this.roll = this.ALPHA * this.roll + (1 - this.ALPHA) * accelRoll;
  }

  private onGyroscopeUpdate(data: { x: number; y: number; z: number }): void {
    const now = Date.now();
    const dt = (now - this.lastTimestamp) / 1000; // seconds
    this.lastTimestamp = now;

    if (dt > 0 && dt < 0.5) {
      // Integrate gyro for pitch/roll (complementary filter)
      this.pitch += data.y * dt * (180 / Math.PI);
      this.roll += data.x * dt * (180 / Math.PI);
    }

    // Track angular movement magnitude for stability assessment
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2) * (180 / Math.PI);
    this.gyroHistory.push({ timestamp: now, magnitude });

    // Trim history to stability window
    const cutoff = now - this.config.stabilityWindowMs;
    this.gyroHistory = this.gyroHistory.filter((h) => h.timestamp >= cutoff);
  }

  private isStable(): boolean {
    if (this.gyroHistory.length < 10) return false;

    const windowStart = Date.now() - this.config.stabilityWindowMs;
    const recentReadings = this.gyroHistory.filter((h) => h.timestamp >= windowStart);

    if (recentReadings.length < 10) return false;

    // All readings must be below threshold
    return recentReadings.every(
      (r) => r.magnitude < this.config.stabilityThresholdDegPerSec,
    );
  }
}
