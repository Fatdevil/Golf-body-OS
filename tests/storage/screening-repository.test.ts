import { ScreeningRepository, StoredScreeningSession } from '../../src/storage/screening-repository';

describe('ScreeningRepository', () => {
  let repo: ScreeningRepository;

  beforeEach(() => {
    // Test with memoryOnly = true to avoid filesystem calls in jest
    repo = new ScreeningRepository(true);
  });

  it('should initialize empty', async () => {
    const sessions = await repo.getSessions();
    expect(sessions).toEqual([]);
    expect(await repo.getLatestSession()).toBeNull();
  });

  it('should save and retrieve sessions ordered by timestamp descending', async () => {
    const s1: StoredScreeningSession = {
      id: 's1',
      timestampMs: 1000,
      testType: 'HIP_HINGE',
      golfBodyScore: 65,
      tier: 'SOLID',
      tierLabel: 'Stadig',
      tierColor: '#10B981',
      subScores: { hipHinge: 35, thoracicRotation: 30 },
      angles: { hipHingeFlexionDeg: 155 },
      compensations: [],
      primaryBottlenecks: ['Hip Hinge'],
      predictedSwingFaults: [],
      prescribedExercises: []
    };

    const s2: StoredScreeningSession = {
      id: 's2',
      timestampMs: 2000,
      testType: 'FULL_BATTERY',
      golfBodyScore: 82,
      tier: 'TOUR_ELITE',
      tierLabel: 'Elit',
      tierColor: '#059669',
      subScores: { hipHinge: 42, thoracicRotation: 40 },
      angles: { hipHingeFlexionDeg: 165, thoracicRightDeg: 45, thoracicLeftDeg: 44 },
      compensations: [],
      primaryBottlenecks: [],
      predictedSwingFaults: [],
      prescribedExercises: []
    };

    await repo.saveSession(s1);
    await repo.saveSession(s2);

    const all = await repo.getSessions();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe('s2'); // most recent first
    expect(all[1].id).toBe('s1');

    const latest = await repo.getLatestSession();
    expect(latest?.id).toBe('s2');
  });

  it('should clear history', async () => {
    const s1: StoredScreeningSession = {
      id: 's1',
      timestampMs: 1000,
      testType: 'HIP_HINGE',
      golfBodyScore: 65,
      tier: 'SOLID',
      tierLabel: 'Stadig',
      tierColor: '#10B981',
      subScores: { hipHinge: 35, thoracicRotation: 30 },
      angles: {},
      compensations: [],
      primaryBottlenecks: [],
      predictedSwingFaults: [],
      prescribedExercises: []
    };

    await repo.saveSession(s1);
    expect((await repo.getSessions()).length).toBe(1);

    await repo.clearHistory();
    expect((await repo.getSessions()).length).toBe(0);
    expect(await repo.getLatestSession()).toBeNull();
  });
});
