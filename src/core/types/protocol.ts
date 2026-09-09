import { LandmarkId } from './landmark';
import { PoseFrame } from './pose-frame';

/**
 * @module protocol
 * Defines test protocols and their requirements.
 */
export const VERSION = 'PROTOCOL_V1';

/** Required camera perspective */
export type CameraView = 'FRONT' | 'SIDE' | 'BACK';

/** Standardized body side */
export type BodySide = 'LEFT' | 'RIGHT' | 'BILATERAL';

/**
 * Step-by-step instruction for user setup or movement.
 */
export interface Instruction {
  /** Instruction text */
  text: string;
  /** Optional reference to an image or animation */
  imageRef?: string;
}

/**
 * Quality check rule for a frame.
 */
export interface QualityRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable description of the rule */
  description: string;
  /** Function to evaluate the rule on a given frame */
  check: (frame: PoseFrame) => boolean;
}

/**
 * Definition of an assessment protocol.
 */
export interface TestProtocol {
  /** Unique protocol identifier */
  id: string;
  /** Protocol version */
  version: string;
  /** Required camera view */
  requiredView: CameraView;
  /** Side of the body to standardize on for asymmetrical tests */
  standardizedSide: BodySide;
  /** Landmarks required on the side closest to camera */
  requiredNearSideLandmarks: LandmarkId[];
  /** Landmarks optionally tracked on the far side */
  optionalFarSideLandmarks: LandmarkId[];
  /** Minimum required visibility score [0.0, 1.0] */
  minVisibility: number;
  /** Minimum number of valid frames required */
  minFrames: number;
  /** Instructions for patient setup */
  setupInstructions: Instruction[];
  /** Instructions for patient movement */
  movementInstructions: Instruction[];
  /** Required number of repetitions */
  repetitionCount: number;
  /** List of quality rules applied during recording */
  qualityRules: QualityRule[];
  /** Identifier of the phase detection algorithm */
  phaseDetector: string;
  /** Identifiers of metrics to calculate */
  metricIds: string[];
}
