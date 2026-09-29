/**
 * Screening Session Repository — Offline Storage & History
 *
 * Persists and retrieves physical screening sessions and historical progression.
 * Uses expo-file-system where available, with in-memory caching and fallback
 * for testing and zero-overhead execution.
 *
 * @module screening-repository
 * @version SCREENING_REPOSITORY_V1
 */

import { File, Paths } from 'expo-file-system';
import { GolfBodyTier } from '../core/metrics/golf-body-score';

export const VERSION = 'SCREENING_REPOSITORY_V1';

export type ScreeningTestType = 'HIP_HINGE' | 'THORACIC_ROTATION' | 'FULL_BATTERY';

export interface StoredScreeningSession {
  id: string;
  timestampMs: number;
  testType: ScreeningTestType;
  golfBodyScore: number; // 0–100
  tier: GolfBodyTier;
  tierLabel: string;
  tierColor: string;
  subScores: {
    hipHinge: number; // 0–50
    thoracicRotation: number; // 0–50
  };
  angles: {
    hipHingeFlexionDeg?: number;
    hipHingeKneeDeg?: number;
    thoracicRightDeg?: number;
    thoracicLeftDeg?: number;
    thoracicAsymmetryDeg?: number;
    pelvicTurnDeg?: number;
  };
  compensations: string[];
  primaryBottlenecks: string[];
  predictedSwingFaults: Array<{
    faultId: string;
    title: string;
    explanation: string;
    prescription: string;
  }>;
  prescribedExercises: Array<{
    name: string;
    targetFault: string;
    setsReps: string;
    description: string;
  }>;
  isSimulated?: boolean;
}

const STORAGE_FILE_NAME = 'screening_history_v1.json';
const MAX_SESSIONS = 50;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates a record read from disk. Records without the fields needed to sort
 * and render a session are dropped; missing optional collections get defaults
 * so older sessions stay readable.
 */
function toValidSession(raw: unknown): StoredScreeningSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<StoredScreeningSession>;
  if (typeof r.id !== 'string' || typeof r.testType !== 'string') return null;
  if (!isFiniteNumber(r.timestampMs) || !isFiniteNumber(r.golfBodyScore)) return null;
  const sub = r.subScores;
  if (!sub || typeof sub !== 'object' || !isFiniteNumber(sub.hipHinge) || !isFiniteNumber(sub.thoracicRotation)) {
    return null;
  }
  return {
    ...(r as StoredScreeningSession),
    angles: r.angles && typeof r.angles === 'object' ? r.angles : {},
    compensations: Array.isArray(r.compensations) ? r.compensations : [],
    primaryBottlenecks: Array.isArray(r.primaryBottlenecks) ? r.primaryBottlenecks : [],
    predictedSwingFaults: Array.isArray(r.predictedSwingFaults) ? r.predictedSwingFaults : [],
    prescribedExercises: Array.isArray(r.prescribedExercises) ? r.prescribedExercises : [],
  };
}

class ScreeningRepository {
  private cache: StoredScreeningSession[] = [];
  private isLoaded: boolean = false;
  private memoryOnly: boolean = false;

  constructor(memoryOnly: boolean = false) {
    this.memoryOnly = memoryOnly;
  }

  private getStorageFile(): File | null {
    if (this.memoryOnly) {
      return null;
    }
    try {
      return new File(Paths.document, STORAGE_FILE_NAME);
    } catch {
      return null;
    }
  }

  /**
   * Initializes and loads sessions from disk into memory cache.
   */
  public async loadSessions(): Promise<StoredScreeningSession[]> {
    if (this.isLoaded) {
      return [...this.cache];
    }

    try {
      const file = this.getStorageFile();
      if (file && file.exists) {
        const content = file.textSync();
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const valid = parsed.map(toValidSession).filter((x): x is StoredScreeningSession => x !== null);
          if (valid.length < parsed.length) {
            console.warn(`[ScreeningRepository] Ignored ${parsed.length - valid.length} invalid stored session(s)`);
          }
          this.cache = valid;
        }
      }
    } catch (err) {
      console.warn('[ScreeningRepository] Could not read sessions from disk, using memory cache:', err);
    }

    this.isLoaded = true;
    return [...this.cache];
  }

  /**
   * Returns all stored sessions sorted with most recent first.
   */
  public async getSessions(): Promise<StoredScreeningSession[]> {
    await this.loadSessions();
    return [...this.cache].sort((a, b) => b.timestampMs - a.timestampMs);
  }

  /**
   * Synchronously returns cached sessions (for instant UI render).
   */
  public getCachedSessions(): StoredScreeningSession[] {
    return [...this.cache].sort((a, b) => b.timestampMs - a.timestampMs);
  }

  /**
   * Returns the most recent session or null.
   */
  public async getLatestSession(): Promise<StoredScreeningSession | null> {
    const sessions = await this.getSessions();
    return (sessions.length > 0 && sessions[0]) ? sessions[0] : null;
  }

  /**
   * Saves a new session and persists it to disk. The memory cache only
   * changes once the write has succeeded, so a failed save leaves history
   * exactly as it was.
   */
  public async saveSession(session: StoredScreeningSession): Promise<{ success: boolean; error?: string }> {
    await this.loadSessions();

    // Deduplicate or insert, keeping max MAX_SESSIONS in history
    const existingIdx = this.cache.findIndex(s => s.id === session.id);
    const next = existingIdx >= 0
      ? this.cache.map((s, i) => (i === existingIdx ? session : s))
      : [session, ...this.cache].slice(0, MAX_SESSIONS);

    if (this.memoryOnly) {
      this.cache = next;
      return { success: true };
    }

    const file = this.getStorageFile();
    if (!file) {
      return { success: false, error: 'Storage file not available' };
    }
    try {
      file.write(JSON.stringify(next, null, 2));
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    this.cache = next;
    return { success: true };
  }

  /**
   * Clears all session history. Rejects if the stored file could not be
   * deleted; the in-memory history is then left unchanged.
   */
  public async clearHistory(): Promise<void> {
    const file = this.getStorageFile();
    if (file && file.exists) {
      file.delete();
    }
    this.cache = [];
    this.isLoaded = true;
  }
}

export const screeningRepository = new ScreeningRepository();
export { ScreeningRepository };
