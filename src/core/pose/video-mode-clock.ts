/**
 * MediaPipe VIDEO-mode clock.
 *
 * PoseLandmarker in VIDEO mode requires strictly increasing timestamps for the
 * lifetime of the landmarker. A timestamp that does not advance throws
 * "Packet timestamp mismatch", and after that the graph rejects every later
 * call as well — including valid ones. Re-scanning part of a video (e.g. the
 * dense impact pass after a coarse pass) or analyzing a second video with the
 * same landmarker therefore silently produced no poses at all.
 *
 * This clock maps media timestamps onto a strictly increasing clock:
 * consecutive frames keep their real spacing (so the tracker sees true
 * inter-frame timing), anchored per sequence so rounding never drifts; a
 * timestamp that does not advance starts a new sequence after a gap.
 *
 * Keep one clock per landmarker instance, for as long as that instance lives.
 *
 * @module video-mode-clock
 * @version VIDEO_MODE_CLOCK_V1
 */

export const VERSION = 'VIDEO_MODE_CLOCK_V1';

/** Gap inserted on the clock when a new, non-advancing sequence starts. */
export const NEW_SEQUENCE_GAP_MS = 1000;

/**
 * Creates a clock function: media timestamp (ms) → MediaPipe timestamp (ms).
 */
export function createVideoModeClock(): (mediaTimestampMs: number) => number {
  let lastInputMs = -Infinity;
  let lastClockMs = -Infinity;
  let sequenceStartClockMs = 0;
  let sequenceStartInputMs = 0;

  return (mediaTimestampMs: number) => {
    if (mediaTimestampMs <= lastInputMs) {
      sequenceStartClockMs = lastClockMs + NEW_SEQUENCE_GAP_MS;
      sequenceStartInputMs = mediaTimestampMs;
    } else if (lastInputMs === -Infinity) {
      sequenceStartInputMs = mediaTimestampMs;
    }
    const clockMs = Math.max(
      lastClockMs + 1,
      sequenceStartClockMs + Math.round(mediaTimestampMs - sequenceStartInputMs),
    );
    lastInputMs = mediaTimestampMs;
    lastClockMs = clockMs;
    return clockMs;
  };
}
