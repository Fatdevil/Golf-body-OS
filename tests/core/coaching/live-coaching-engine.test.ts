import { AudioCoachService } from '../../../src/core/coaching/audio-coach';
import { LiveCoachingEngine } from '../../../src/core/coaching/live-coaching-engine';
import { PoseFrame } from '../../../src/core/types/pose-frame';
import { LandmarkId } from '../../../src/core/types/landmark';

describe('AudioCoachService', () => {
  let coach: AudioCoachService;

  beforeEach(() => {
    coach = new AudioCoachService({ formCooldownMs: 3000 });
  });

  it('respects language configuration', () => {
    expect(coach.getLanguage()).toBe('en-US');
    coach.setLanguage('sv-SE');
    expect(coach.getLanguage()).toBe('sv-SE');
  });

  it('respects mute setting', () => {
    expect(coach.getMuted()).toBe(false);
    coach.setMuted(true);
    expect(coach.getMuted()).toBe(true);
    expect(coach.speak('COUNTDOWN_GO', 'HIGH')).toBe(false);
  });

  it('respects coaching mode (GUIDED, CORRECTIVE, REPS_ONLY, MUTED)', () => {
    (global as any).window = {
      speechSynthesis: {
        cancel: jest.fn(),
        speak: jest.fn(),
        getVoices: jest.fn().mockReturnValue([])
      }
    };
    (global as any).SpeechSynthesisUtterance = jest.fn();

    expect(coach.getMode()).toBe('GUIDED');

    // In GUIDED mode: both pacing and form cues speak
    expect(coach.speak('CUE_HINGE_DOWN', 'NORMAL', 1000)).toBe(true);

    // In CORRECTIVE mode: pacing cues are silent, but form error cues speak!
    coach.setMode('CORRECTIVE');
    expect(coach.getMode()).toBe('CORRECTIVE');
    expect(coach.speak('CUE_HINGE_DOWN', 'NORMAL', 2000)).toBe(false); // pacing is silent
    expect(coach.speak('CUE_STRAIGHTEN_LEGS', 'NORMAL', 5000)).toBe(true); // form correction speaks!

    // In REPS_ONLY: both pacing and form cues are silent, only rep completion speaks
    coach.setMode('REPS_ONLY');
    expect(coach.getMode()).toBe('REPS_ONLY');
    expect(coach.speak('CUE_STRAIGHTEN_LEGS', 'NORMAL', 6000)).toBe(false);
    expect(coach.speak('REP_1_DONE', 'HIGH', 7000)).toBe(true);

    // In MUTED mode: even high priority cues are silent
    coach.setMode('MUTED');
    expect(coach.speak('REP_1_DONE', 'HIGH', 8000)).toBe(false);
  });

  it('tracks spoken cue history and fires callback', () => {
    // Mock window.speechSynthesis in node test environment
    (global as any).window = {
      speechSynthesis: {
        cancel: jest.fn(),
        speak: jest.fn(),
        getVoices: jest.fn().mockReturnValue([])
      }
    };
    (global as any).SpeechSynthesisUtterance = jest.fn();

    const callbackLog: string[] = [];
    coach.onSpoken((entry) => {
      callbackLog.push(entry.key);
    });

    const spoken = coach.speak('COUNTDOWN_GO', 'HIGH', 1000);
    expect(spoken).toBe(true);
    expect(coach.getHistory().length).toBe(1);
    expect(coach.getHistory()[0].key).toBe('COUNTDOWN_GO');
    expect(callbackLog).toEqual(['COUNTDOWN_GO']);

    coach.clearHistory();
    expect(coach.getHistory().length).toBe(0);
  });

  it('speaks sequence of briefing cues and triggers onComplete', () => {
    (global as any).window = {
      speechSynthesis: {
        cancel: jest.fn(),
        speak: jest.fn((utterance) => {
          utterance.onend?.();
        }),
        getVoices: jest.fn().mockReturnValue([])
      }
    };
    (global as any).SpeechSynthesisUtterance = function (text: string) {
      (this as any).text = text;
    };

    let completed = false;
    coach.speakSequence(
      ['BRIEFING_ROTATION_1', 'BRIEFING_ROTATION_2', 'BRIEFING_ROTATION_3'],
      () => {
        completed = true;
      }
    );

    expect(completed).toBe(true);
    expect(coach.getHistory().length).toBe(3);
    expect(coach.getHistory().map(h => h.key)).toEqual([
      'BRIEFING_ROTATION_1',
      'BRIEFING_ROTATION_2',
      'BRIEFING_ROTATION_3'
    ]);
  });
});

describe('LiveCoachingEngine', () => {
  let mockCoach: AudioCoachService;
  let spokenCues: string[] = [];
  let completedRepsList: number[] = [];
  let allCompleted = false;
  let engine: LiveCoachingEngine;

  const createMockFrame = (
    timestampMs: number,
    frameId: number,
    coords: {
      shoulder: { x: number; y: number };
      hip: { x: number; y: number };
      knee: { x: number; y: number };
      ankle: { x: number; y: number };
      ear?: { x: number; y: number };
    }
  ): PoseFrame => {
    const landmarks = Array.from({ length: 33 }, (_, i) => ({
      id: i as LandmarkId,
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.9,
      presence: 0.9
    }));

    landmarks[LandmarkId.LEFT_SHOULDER] = { id: LandmarkId.LEFT_SHOULDER, x: coords.shoulder.x, y: coords.shoulder.y, z: 0, visibility: 0.9, presence: 0.9 };
    landmarks[LandmarkId.LEFT_HIP] = { id: LandmarkId.LEFT_HIP, x: coords.hip.x, y: coords.hip.y, z: 0, visibility: 0.9, presence: 0.9 };
    landmarks[LandmarkId.LEFT_KNEE] = { id: LandmarkId.LEFT_KNEE, x: coords.knee.x, y: coords.knee.y, z: 0, visibility: 0.9, presence: 0.9 };
    landmarks[LandmarkId.LEFT_ANKLE] = { id: LandmarkId.LEFT_ANKLE, x: coords.ankle.x, y: coords.ankle.y, z: 0, visibility: 0.9, presence: 0.9 };
    if (coords.ear) {
      landmarks[LandmarkId.LEFT_EAR] = { id: LandmarkId.LEFT_EAR, x: coords.ear.x, y: coords.ear.y, z: 0, visibility: 0.9, presence: 0.9 };
    }

    return {
      frameId,
      timestampMs,
      width: 640,
      height: 480,
      landmarks,
      model: 'test',
      modelVersion: '1.0'
    };
  };

  beforeEach(() => {
    spokenCues = [];
    completedRepsList = [];
    allCompleted = false;

    mockCoach = new AudioCoachService({ formCooldownMs: 1000 });
    // Mock the actual TTS speak call to record keys
    jest.spyOn(mockCoach, 'speak').mockImplementation((key) => {
      spokenCues.push(key);
      return true;
    });

    engine = new LiveCoachingEngine(mockCoach, {
      onRepComplete: (rep) => completedRepsList.push(rep),
      onAllRepsComplete: () => { allCompleted = true; }
    });
  });

  it('triggers CUE_STRAIGHTEN_LEGS when knee angle drops significantly during hinge', () => {
    // 1. Upright setup frame (hip hinge 170°, knee ~170°)
    const upright = createMockFrame(100, 1, {
      shoulder: { x: 0, y: 0.4 },
      hip: { x: 0, y: 0 },
      knee: { x: 0, y: -0.2 },
      ankle: { x: 0, y: -0.4 }
    });
    engine.processFrame(upright);

    // 2. Deep bent-knee hinge (hip moves back and down, knee bends sharply to ~110°)
    // Hip at (-0.1, -0.05), Shoulder at (0.2, 0.05), Knee at (0.1, -0.2), Ankle at (0, -0.4)
    for (let f = 1; f <= 6; f++) {
      const bentFrame = createMockFrame(100 + f * 33, f + 1, {
        shoulder: { x: 0.25, y: -0.05 },
        hip: { x: -0.15, y: -0.05 },
        knee: { x: 0.15, y: -0.22 }, // knee moves far forward, sharp bend
        ankle: { x: 0, y: -0.4 }
      });
      engine.processFrame(bentFrame);
    }

    expect(spokenCues).toContain('CUE_STRAIGHTEN_LEGS');
  });
});
