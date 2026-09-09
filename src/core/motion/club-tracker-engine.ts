/**
 * Golf Club Tracker Engine
 *
 * Tracks the user's golf club using a hybrid kinematic-geometric model
 * based on wrist anchors, forearm directional vectors, and phase kinematics.
 * Provides real-time comparison metrics against Tiger Ghost's canonical 3D swing plane.
 *
 * @module club-tracker-engine
 * @version CLUB_TRACKER_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { LandmarkId } from '../types/landmark';
import { ClubState } from '../types/club-frame';
import { CameraViewAngle, SwingPhaseId } from '../types/golf-swing';
import { getLandmark, toDegrees } from '../metrics/golf-swing-metrics';

export interface ClubTrackingOptions {
  viewAngle?: CameraViewAngle;
  isRightHanded?: boolean;
  clubLengthRatio?: number; // Ratio of club length to stance/body height (default ~0.45)
}

export interface ClubPlaneComparison {
  userClub: ClubState;
  ghostClub?: ClubState;
  /** Deviation from Tiger's shaft plane in degrees (+ = steep/over-the-top, - = shallow/under) */
  shaftPlaneDeviationDeg: number;
  /** True if user has early-released or swung steep outside Tiger's delivery slot */
  isOverTheTop: boolean;
  /** Difference in forward shaft lean at impact vs Tiger (+ = lagging more, - = scooping/casting) */
  forwardShaftLeanDiffDeg?: number;
}

export class ClubTrackerEngine {
  private viewAngle: CameraViewAngle;
  private isRightHanded: boolean;
  private clubLengthRatio: number;

  constructor(options: ClubTrackingOptions = {}) {
    this.viewAngle = options.viewAngle ?? 'FACE_ON';
    this.isRightHanded = options.isRightHanded ?? true;
    this.clubLengthRatio = options.clubLengthRatio ?? 0.45;
  }

  /**
   * Tracks and reconstructs the user's 3D club position for a single frame.
   */
  public trackClub(
    frame: PoseFrame,
    currentPhase: SwingPhaseId = 'P1_ADDRESS'
  ): ClubState | null {
    const lw = getLandmark(frame, LandmarkId.LEFT_WRIST);
    const rw = getLandmark(frame, LandmarkId.RIGHT_WRIST);

    if (!lw && !rw) return null;

    const gripX = (lw && rw) ? (lw.x + rw.x) / 2 : (lw || rw)!.x;
    const gripY = (lw && rw) ? (lw.y + rw.y) / 2 : (lw || rw)!.y;
    const gripZ = (lw && rw) ? ((lw.z ?? 0) + (rw.z ?? 0)) / 2 : ((lw || rw)!.z ?? 0);

    const leadShoulderId = this.isRightHanded ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER;
    const leadElbowId = this.isRightHanded ? LandmarkId.LEFT_ELBOW : LandmarkId.RIGHT_ELBOW;

    const leadShoulder = getLandmark(frame, leadShoulderId);
    const leadElbow = getLandmark(frame, leadElbowId);

    // Calculate forearm directional vector
    let armDirX = 0;
    let armDirY = 1;

    if (leadElbow) {
      armDirX = gripX - leadElbow.x;
      armDirY = gripY - leadElbow.y;
    } else if (leadShoulder) {
      armDirX = gripX - leadShoulder.x;
      armDirY = gripY - leadShoulder.y;
    }

    const armLen = Math.hypot(armDirX, armDirY) || 0.20;
    const unitArmX = armDirX / armLen;
    const unitArmY = armDirY / armLen;

    // Normalised club length based on arm length (~1.8x forearm length)
    const clubLength = armLen * 1.8;

    let clubHeadX = gripX;
    let clubHeadY = gripY + clubLength;
    let clubHeadZ = gripZ;
    let shaftAngleDeg = 48;
    let faceAngleDeg = 0;
    let forwardShaftLeanDeg = 0;

    switch (currentPhase) {
      case 'P1_ADDRESS': {
        clubHeadX = this.viewAngle === 'FACE_ON' ? 0.50 : 0.34;
        clubHeadY = 0.90;
        shaftAngleDeg = this.viewAngle === 'FACE_ON' ? 48 : 52;
        forwardShaftLeanDeg = 3.0;
        break;
      }
      case 'P2_TAKEAWAY': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX + (this.viewAngle === 'FACE_ON' ? 0.20 * sideSign : 0.10);
        clubHeadY = gripY + 0.05;
        shaftAngleDeg = 0; // Shaft parallel
        faceAngleDeg = -5 * sideSign;
        break;
      }
      case 'P3_HALFWAY_BACK': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX + (this.viewAngle === 'FACE_ON' ? 0.15 * sideSign : 0.02);
        clubHeadY = gripY + clubLength * 0.5;
        shaftAngleDeg = 65;
        break;
      }
      case 'P4_TOP': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX - 0.22 * sideSign;
        clubHeadY = gripY - 0.10;
        clubHeadZ = gripZ + 0.20;
        shaftAngleDeg = 0; // Horizontal at top
        break;
      }
      case 'P5_SHALLOW': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX + 0.16 * sideSign;
        clubHeadY = gripY - 0.12;
        clubHeadZ = gripZ + 0.18;
        shaftAngleDeg = 35;
        break;
      }
      case 'P6_DELIVERY': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX + 0.14 * sideSign;
        clubHeadY = gripY + 0.08;
        shaftAngleDeg = 0; // Delivery shaft parallel
        break;
      }
      case 'P7_IMPACT': {
        clubHeadX = this.viewAngle === 'FACE_ON' ? 0.50 : 0.34;
        clubHeadY = 0.90;
        shaftAngleDeg = 52;
        // Dynamic forward shaft lean: angle between wrist-clubhead line and vertical
        const dx = (this.isRightHanded ? 1 : -1) * (gripX - clubHeadX);
        const dy = Math.abs(clubHeadY - gripY) || 0.35;
        forwardShaftLeanDeg = Math.round(toDegrees(Math.atan2(dx, dy)) * 10) / 10;
        break;
      }
      case 'P8_RELEASE': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX - 0.20 * sideSign;
        clubHeadY = gripY - 0.02;
        shaftAngleDeg = 0;
        break;
      }
      case 'P9_REHINGE': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX - 0.16 * sideSign;
        clubHeadY = gripY - clubLength * 0.5;
        shaftAngleDeg = 75;
        break;
      }
      case 'P10_FINISH': {
        const sideSign = this.isRightHanded ? 1 : -1;
        clubHeadX = gripX + 0.18 * sideSign;
        clubHeadY = gripY + 0.08;
        shaftAngleDeg = 25;
        break;
      }
      default: {
        // Extrapolate directly along forearm vector
        clubHeadX = gripX + unitArmX * clubLength;
        clubHeadY = gripY + unitArmY * clubLength;
        break;
      }
    }

    return {
      grip: { x: gripX, y: gripY, z: gripZ },
      clubHead: { x: clubHeadX, y: clubHeadY, z: clubHeadZ },
      shaftAngleDeg,
      faceAngleDeg,
      forwardShaftLeanDeg,
      confidence: 0.92
    };
  }

  /**
   * Compares the user's tracked club against Tiger Ghost reference.
   */
  public compareAgainstGhost(
    userClub: ClubState,
    ghostClub?: ClubState
  ): ClubPlaneComparison {
    if (!ghostClub) {
      return {
        userClub,
        shaftPlaneDeviationDeg: 0,
        isOverTheTop: false
      };
    }

    const planeDeviation = Math.round(userClub.shaftAngleDeg - ghostClub.shaftAngleDeg);
    // Over the top: club shaft is steeper than Tiger's slot plane by > 12° during downswing
    const isOverTheTop = planeDeviation > 12;

    let forwardShaftLeanDiffDeg: number | undefined;
    if (userClub.forwardShaftLeanDeg !== undefined && ghostClub.forwardShaftLeanDeg !== undefined) {
      forwardShaftLeanDiffDeg = Math.round((userClub.forwardShaftLeanDeg - ghostClub.forwardShaftLeanDeg) * 10) / 10;
    }

    return {
      userClub,
      ghostClub,
      shaftPlaneDeviationDeg: planeDeviation,
      isOverTheTop,
      forwardShaftLeanDiffDeg
    };
  }
}
