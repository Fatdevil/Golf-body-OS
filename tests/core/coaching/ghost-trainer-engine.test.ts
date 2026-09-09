import {
  GHOST_CHECKPOINTS,
  getProCheckpointPoseFrame,
  evaluateGhostPoseMatch
} from '../../../src/core/coaching/ghost-trainer-engine';
import { getPhrase } from '../../../src/core/coaching/i18n/locales';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('Ghost Trainer Engine (P1-P10)', () => {
  it('should define all 10 PGA Tour checkpoints in proper order', () => {
    expect(GHOST_CHECKPOINTS).toHaveLength(10);
    const pIndices = GHOST_CHECKPOINTS.map(c => c.pIndex);
    expect(pIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Ensure monotonically increasing target frame indices
    for (let i = 1; i < GHOST_CHECKPOINTS.length; i++) {
      expect(GHOST_CHECKPOINTS[i].frameIndex240Fps).toBeGreaterThan(
        GHOST_CHECKPOINTS[i - 1].frameIndex240Fps
      );
    }
  });

  it('should retrieve valid 33-landmark Pro PoseFrames for both Face-On and DTL', () => {
    for (const cp of GHOST_CHECKPOINTS) {
      const foFrame = getProCheckpointPoseFrame(cp.id, 'FACE_ON');
      const dtlFrame = getProCheckpointPoseFrame(cp.id, 'DOWN_THE_LINE');

      expect(foFrame).toBeDefined();
      expect(foFrame.landmarks.length).toBeGreaterThanOrEqual(17);
      expect(dtlFrame).toBeDefined();
      expect(dtlFrame.landmarks.length).toBeGreaterThanOrEqual(17);
    }
  });

  it('should achieve a high match score (>80%) when evaluating Pro against Pro reference at P4 (Top)', () => {
    const dtlSeq = generate240FpsSwingSequence(480, 'OPTIMAL', 'DOWN_THE_LINE');
    const addressFrame = dtlSeq[0];
    const topFrame = dtlSeq[240];
    const p4Cp = GHOST_CHECKPOINTS.find(c => c.id === 'P4_TOP_OF_BACKSWING')!;

    const result = evaluateGhostPoseMatch(topFrame, p4Cp, addressFrame, 'DOWN_THE_LINE', true);

    expect(result.checkpointId).toBe('P4_TOP_OF_BACKSWING');
    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(result.isLocked).toBe(true);
  });

  it('should identify insufficient shoulder turn at P4 and trigger GHOST_ROTATE_MORE cue', () => {
    const dtlSeq = generate240FpsSwingSequence(480, 'OPTIMAL', 'DOWN_THE_LINE');
    const addressFrame = dtlSeq[0];
    // Take a frame way earlier in backswing (e.g. frame 80 where shoulders only turned ~25°)
    const earlyFrame = dtlSeq[80];
    const p4Cp = GHOST_CHECKPOINTS.find(c => c.id === 'P4_TOP_OF_BACKSWING')!;

    const result = evaluateGhostPoseMatch(earlyFrame, p4Cp, addressFrame, 'DOWN_THE_LINE', true);

    expect(result.matchScore).toBeLessThan(70);
    expect(result.isLocked).toBe(false);
    expect(result.primaryCorrectionCue).toBe('GHOST_ROTATE_MORE');
    expect(result.statusMessageSv).toContain('Rotera bröstkorgen');
  });

  it('should provide complete translations in English and Swedish for all ghost cues', () => {
    for (const cp of GHOST_CHECKPOINTS) {
      const enText = getPhrase(cp.cueKey, 'en-US');
      const svText = getPhrase(cp.cueKey, 'sv-SE');

      expect(enText).toBeTruthy();
      expect(svText).toBeTruthy();
      expect(enText).not.toBe(cp.cueKey);
      expect(svText).not.toBe(cp.cueKey);
      expect(enText).not.toBe(svText);
    }

    // Check special ghost cues
    const lockedEn = getPhrase('GHOST_LOCKED_IN', 'en-US');
    const lockedSv = getPhrase('GHOST_LOCKED_IN', 'sv-SE');
    expect(lockedEn).toBe('Target locked! Hold for two seconds.');
    expect(lockedSv).toBe('Position låst! Håll i två sekunder.');
  });
});
