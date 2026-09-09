/**
 * @module annotation-stats
 * Statistical utilities for manual annotations (GT-1).
 */
import { MetricValue } from '../metrics/hip-hinge-metrics';
import { Landmark } from '../types/landmark';

export interface Point2D {
  x: number;
  y: number;
}

export interface ManualAnnotation {
  repIndex: number;
  attempt: number;
  shoulder: Point2D;
  hip: Point2D;
  knee: Point2D;
  ankle: Point2D;
  heel?: Point2D;
}

export interface AnnotationSummary {
  manualMean: number;
  manualSampleSD: number;
  manualMin: number;
  manualMax: number;
  manualRange: number;
  frameLocalMediaPipeValue: number;
  signedError: number;
  absoluteError: number;
}

export function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calculateSummary(manualValues: number[], mediapipeValue: number): AnnotationSummary {
  if (manualValues.length === 0) {
    throw new Error('No manual values provided for summary');
  }

  const min = Math.min(...manualValues);
  const max = Math.max(...manualValues);
  const mean = manualValues.reduce((sum, v) => sum + v, 0) / manualValues.length;
  
  return {
    manualMean: mean,
    manualSampleSD: sampleStandardDeviation(manualValues),
    manualMin: min,
    manualMax: max,
    manualRange: max - min,
    frameLocalMediaPipeValue: mediapipeValue,
    signedError: mediapipeValue - mean,
    absoluteError: Math.abs(mediapipeValue - mean)
  };
}

export function pixelDistance(p1: Point2D, p2: Point2D, width: number, height: number): number {
  const dx = (p1.x - p2.x) * width;
  const dy = (p1.y - p2.y) * height;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalizedImageDistance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}
