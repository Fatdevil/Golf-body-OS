/**
 * Sportsbox AI-Style 3D Biomechanical Avatar Renderer
 *
 * Renders an anatomical 3D golfer mannequin on HTML5 Canvas:
 * - Volumetric shaded 3D porcelain-white limbs (capsules with specular highlight & shadow)
 * - Signature Sportsbox AI royal purple 3D joint spheres (#a855f7 / #7e22ce)
 * - Signature Sportsbox AI golden rotation skewers (#eab308) piercing chest and pelvis
 * - 3D athletic torso and pelvis blocks
 * - Smooth graphite club shaft and head
 *
 * @module SportsboxAvatarRenderer
 */

import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { CameraViewAngle } from '../../../../src/core/types/golf-swing';

export interface AvatarRenderOptions {
  isGhost?: boolean;
  ghostMatched?: boolean;
  opacity?: number;
  showSkewers?: boolean;
  viewAngle?: CameraViewAngle;
  chestTurnDeg?: number;
  pelvisTurnDeg?: number;
}

function getLm(frame: PoseFrame, id: LandmarkId): Landmark | undefined {
  return frame.landmarks.find(l => l.id === id);
}

/**
 * Draws a 3D volumetric capsule between two points with radial endcaps and cylindrical lighting.
 */
function draw3DCapsule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  isGhost: boolean,
  ghostMatched: boolean
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  // Four corners of tapered cylinder
  const p1x = x1 + nx * r1;
  const p1y = y1 + ny * r1;
  const p2x = x2 + nx * r2;
  const p2y = y2 + ny * r2;
  const p3x = x2 - nx * r2;
  const p3y = y2 - ny * r2;
  const p4x = x1 - nx * r1;
  const p4y = y1 - ny * r1;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(p4x, p4y);
  ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();

  // Cylindrical shading gradient perpendicular to limb axis
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const avgR = (r1 + r2) / 2;
  const grad = ctx.createLinearGradient(
    midX - nx * avgR,
    midY - ny * avgR,
    midX + nx * avgR,
    midY + ny * avgR
  );

  if (isGhost) {
    if (ghostMatched) {
      grad.addColorStop(0.0, 'rgba(16, 185, 129, 0.25)');
      grad.addColorStop(0.4, 'rgba(52, 211, 153, 0.65)');
      grad.addColorStop(0.7, 'rgba(167, 243, 208, 0.85)');
      grad.addColorStop(1.0, 'rgba(5, 150, 105, 0.35)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    } else {
      grad.addColorStop(0.0, 'rgba(217, 119, 6, 0.20)');
      grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.50)');
      grad.addColorStop(0.7, 'rgba(254, 240, 138, 0.70)');
      grad.addColorStop(1.0, 'rgba(180, 83, 9, 0.30)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
    }
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  } else {
    // Sportsbox AI Pure Porcelain White 3D Mannequin
    grad.addColorStop(0.0, '#94a3b8'); // Shadow side
    grad.addColorStop(0.25, '#e2e8f0');
    grad.addColorStop(0.55, '#ffffff'); // 3D Specular reflection
    grad.addColorStop(0.85, '#f1f5f9');
    grad.addColorStop(1.0, '#64748b'); // Edge contour

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a signature Sportsbox AI 3D purple joint sphere.
 */
function draw3DJoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isGhost: boolean,
  ghostMatched: boolean
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);

  if (isGhost) {
    ctx.fillStyle = ghostMatched ? '#34d399' : '#fbbf24';
    ctx.shadowColor = ghostMatched ? '#10b981' : '#f59e0b';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Sportsbox AI Signature Royal Purple 3D Spheres
    const grad = ctx.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.35,
      radius * 0.1,
      x,
      y,
      radius
    );
    grad.addColorStop(0.0, '#f3e8ff'); // Highlight
    grad.addColorStop(0.3, '#c084fc');
    grad.addColorStop(0.65, '#9333ea'); // Sportsbox purple
    grad.addColorStop(1.0, '#581c87'); // Deep shadow

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws Sportsbox AI's signature Golden Rotation Skewer (Axis rod piercing chest/pelvis).
 */
function drawRotationSkewer(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angleRad: number,
  length: number,
  label: string
) {
  const halfLen = length / 2;
  const x1 = centerX - Math.cos(angleRad) * halfLen;
  const y1 = centerY - Math.sin(angleRad) * halfLen;
  const x2 = centerX + Math.cos(angleRad) * halfLen;
  const y2 = centerY + Math.sin(angleRad) * halfLen;

  ctx.save();

  // Outer gold glow
  ctx.shadowColor = 'rgba(234, 179, 8, 0.75)';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#facc15'; // Brilliant yellow
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Core bright reflection
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead at positive direction (target-facing)
  const headLen = 7;
  const aAngle = angleRad;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(aAngle - Math.PI / 6),
    y2 - headLen * Math.sin(aAngle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(aAngle + Math.PI / 6),
    y2 - headLen * Math.sin(aAngle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Skewer Center Origin Dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
  ctx.fill();

  // Badge label
  if (label) {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 9px sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText(label, x2 + 6, y2 + 3);
  }

  ctx.restore();
}

/**
 * Main Render Function: Renders a PoseFrame as a Sportsbox AI 3D Avatar.
 */
export function renderSportsboxAvatar(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  width: number,
  height: number,
  options: AvatarRenderOptions = {}
) {
  if (!frame || !frame.landmarks || frame.landmarks.length < 17) return;

  const isGhost = options.isGhost ?? false;
  const ghostMatched = options.ghostMatched ?? false;
  const showSkewers = options.showSkewers ?? (!isGhost);

  // Landmarks
  const nose = getLm(frame, LandmarkId.NOSE);
  const ls = getLm(frame, LandmarkId.LEFT_SHOULDER);
  const rs = getLm(frame, LandmarkId.RIGHT_SHOULDER);
  const le = getLm(frame, LandmarkId.LEFT_ELBOW);
  const re = getLm(frame, LandmarkId.RIGHT_ELBOW);
  const lw = getLm(frame, LandmarkId.LEFT_WRIST);
  const rw = getLm(frame, LandmarkId.RIGHT_WRIST);
  const lh = getLm(frame, LandmarkId.LEFT_HIP);
  const rh = getLm(frame, LandmarkId.RIGHT_HIP);
  const lk = getLm(frame, LandmarkId.LEFT_KNEE);
  const rk = getLm(frame, LandmarkId.RIGHT_KNEE);
  const la = getLm(frame, LandmarkId.LEFT_ANKLE);
  const ra = getLm(frame, LandmarkId.RIGHT_ANKLE);

  if (!ls || !rs || !lh || !rh) return;

  const toPx = (p: Landmark) => ({ x: p.x * width, y: p.y * height, z: p.z ?? 0 });

  const pLS = toPx(ls);
  const pRS = toPx(rs);
  const pLH = toPx(lh);
  const pRH = toPx(rh);
  const pLE = le ? toPx(le) : null;
  const pRE = re ? toPx(re) : null;
  const pLW = lw ? toPx(lw) : null;
  const pRW = rw ? toPx(rw) : null;
  const pLK = lk ? toPx(lk) : null;
  const pRK = rk ? toPx(rk) : null;
  const pLA = la ? toPx(la) : null;
  const pRA = ra ? toPx(ra) : null;

  const midShoulder = { x: (pLS.x + pRS.x) / 2, y: (pLS.y + pRS.y) / 2 };
  const midHip = { x: (pLH.x + pRH.x) / 2, y: (pLH.y + pRH.y) / 2 };

  // 1. Torso & Pelvis 3D Blocks
  let hip1 = pLH;
  let hip2 = pRH;
  if (Math.hypot(hip2.x - hip1.x, hip2.y - hip1.y) < 14) {
    hip1 = { x: midHip.x - 8, y: midHip.y, z: 0 };
    hip2 = { x: midHip.x + 8, y: midHip.y, z: 0 };
  }
  let sh1 = pLS;
  let sh2 = pRS;
  if (Math.hypot(sh2.x - sh1.x, sh2.y - sh1.y) < 16) {
    sh1 = { x: midShoulder.x - 12, y: midShoulder.y, z: 0 };
    sh2 = { x: midShoulder.x + 12, y: midShoulder.y, z: 0 };
  }

  // Pelvis girdle block
  draw3DCapsule(ctx, hip1.x, hip1.y, hip2.x, hip2.y, 11, 11, isGhost, ghostMatched);
  // Spine core cylinder
  draw3DCapsule(ctx, midHip.x, midHip.y, midShoulder.x, midShoulder.y, 14, 16, isGhost, ghostMatched);
  // Shoulder chest block
  draw3DCapsule(ctx, sh1.x, sh1.y, sh2.x, sh2.y, 13, 13, isGhost, ghostMatched);

  // 2. Legs (Thighs & Calves)
  if (pLK && pLA) {
    draw3DCapsule(ctx, pLH.x, pLH.y, pLK.x, pLK.y, 12, 10, isGhost, ghostMatched);
    draw3DCapsule(ctx, pLK.x, pLK.y, pLA.x, pLA.y, 10, 8, isGhost, ghostMatched);
  }
  if (pRK && pRA) {
    draw3DCapsule(ctx, pRH.x, pRH.y, pRK.x, pRK.y, 12, 10, isGhost, ghostMatched);
    draw3DCapsule(ctx, pRK.x, pRK.y, pRA.x, pRA.y, 10, 8, isGhost, ghostMatched);
  }

  // 3. Arms (Upper arms & Forearms)
  if (pLE && pLW) {
    draw3DCapsule(ctx, pLS.x, pLS.y, pLE.x, pLE.y, 10, 8.5, isGhost, ghostMatched);
    draw3DCapsule(ctx, pLE.x, pLE.y, pLW.x, pLW.y, 8.5, 7, isGhost, ghostMatched);
  }
  if (pRE && pRW) {
    draw3DCapsule(ctx, pRS.x, pRS.y, pRE.x, pRE.y, 10, 8.5, isGhost, ghostMatched);
    draw3DCapsule(ctx, pRE.x, pRE.y, pRW.x, pRW.y, 8.5, 7, isGhost, ghostMatched);
  }

  // 4. Joints (Sportsbox AI Purple Spheres)
  const jointRadius = isGhost ? 4 : 5.5;
  draw3DJoint(ctx, pLS.x, pLS.y, jointRadius, isGhost, ghostMatched);
  draw3DJoint(ctx, pRS.x, pRS.y, jointRadius, isGhost, ghostMatched);
  draw3DJoint(ctx, pLH.x, pLH.y, jointRadius, isGhost, ghostMatched);
  draw3DJoint(ctx, pRH.x, pRH.y, jointRadius, isGhost, ghostMatched);

  if (pLE) draw3DJoint(ctx, pLE.x, pLE.y, jointRadius * 0.9, isGhost, ghostMatched);
  if (pRE) draw3DJoint(ctx, pRE.x, pRE.y, jointRadius * 0.9, isGhost, ghostMatched);
  if (pLW) draw3DJoint(ctx, pLW.x, pLW.y, jointRadius * 0.8, isGhost, ghostMatched);
  if (pRW) draw3DJoint(ctx, pRW.x, pRW.y, jointRadius * 0.8, isGhost, ghostMatched);
  if (pLK) draw3DJoint(ctx, pLK.x, pLK.y, jointRadius, isGhost, ghostMatched);
  if (pRK) draw3DJoint(ctx, pRK.x, pRK.y, jointRadius, isGhost, ghostMatched);
  if (pLA) draw3DJoint(ctx, pLA.x, pLA.y, jointRadius * 0.85, isGhost, ghostMatched);
  if (pRA) draw3DJoint(ctx, pRA.x, pRA.y, jointRadius * 0.85, isGhost, ghostMatched);

  // 5. 3D Mannequin Head
  if (nose) {
    const headX = nose.x * width;
    const headY = nose.y * height;
    const headR = 14;

    ctx.save();
    // Neck
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(midShoulder.x, midShoulder.y);
    ctx.lineTo(headX, headY + 8);
    ctx.stroke();

    // 3D Head Sphere
    const headGrad = ctx.createRadialGradient(
      headX - 4,
      headY - 4,
      2,
      headX,
      headY,
      headR
    );
    if (isGhost) {
      headGrad.addColorStop(0.0, ghostMatched ? '#a7f3d0' : '#fef08a');
      headGrad.addColorStop(0.6, ghostMatched ? '#10b981' : '#f59e0b');
      headGrad.addColorStop(1.0, ghostMatched ? '#047857' : '#b45309');
    } else {
      headGrad.addColorStop(0.0, '#ffffff');
      headGrad.addColorStop(0.45, '#f1f5f9');
      headGrad.addColorStop(0.85, '#cbd5e1');
      headGrad.addColorStop(1.0, '#64748b');
    }

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Signature Sportsbox AI Golden Rotation Skewers (Turn Rods)
  if (showSkewers) {
    const sDeg = options.chestTurnDeg ?? 0;
    const pDeg = options.pelvisTurnDeg ?? 0;
    const chestAngle = options.viewAngle === 'DOWN_THE_LINE'
      ? Math.sin((sDeg * Math.PI) / 180) * 0.55
      : Math.atan2(pRS.y - pLS.y, pRS.x - pLS.x);
    const pelvisAngle = options.viewAngle === 'DOWN_THE_LINE'
      ? Math.sin((pDeg * Math.PI) / 180) * 0.40
      : Math.atan2(pRH.y - pLH.y, pRH.x - pLH.x);

    // Chest Skewer (Shoulder Tilt & Turn axis)
    drawRotationSkewer(
      ctx,
      midShoulder.x,
      midShoulder.y,
      chestAngle,
      width * 0.24,
      options.chestTurnDeg !== undefined ? `${Math.round(Math.abs(sDeg))}° CHEST` : ''
    );

    // Pelvis Skewer (Pelvis Tilt & Turn axis)
    drawRotationSkewer(
      ctx,
      midHip.x,
      midHip.y,
      pelvisAngle,
      width * 0.20,
      options.pelvisTurnDeg !== undefined ? `${Math.round(Math.abs(pDeg))}° PELVIS` : ''
    );
  }

  // 7. 3D Golf Club (Sleek graphite shaft & clubhead)
  const club = frame.club;
  if (club || (pLW && pRW)) {
    const gripX = club ? club.grip.x * width : (pLW!.x + pRW!.x) / 2;
    const gripY = club ? club.grip.y * height : (pLW!.y + pRW!.y) / 2;
    const clubX = club ? club.clubHead.x * width : gripX;
    const clubY = club ? club.clubHead.y * height : gripY + height * 0.35;

    ctx.save();
    // Steel / Graphite Shaft
    const shaftGrad = ctx.createLinearGradient(gripX, gripY, clubX, clubY);
    shaftGrad.addColorStop(0.0, '#38bdf8');
    shaftGrad.addColorStop(0.5, '#e2e8f0');
    shaftGrad.addColorStop(1.0, '#00f0ff');

    ctx.strokeStyle = isGhost ? (ghostMatched ? '#34d399' : '#fbbf24') : shaftGrad;
    ctx.lineWidth = isGhost ? 2.0 : 3.0;
    if (isGhost) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(clubX, clubY);
    ctx.stroke();

    // Clubhead
    ctx.fillStyle = isGhost ? (ghostMatched ? '#34d399' : '#fbbf24') : '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = isGhost ? 0 : 8;
    ctx.beginPath();
    ctx.arc(clubX, clubY, isGhost ? 5 : 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}
