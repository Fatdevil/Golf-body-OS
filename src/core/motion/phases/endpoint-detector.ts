export const VERSION = 'ENDPOINT_DETECTOR_V1';

export interface EndpointResult {
  value: number;           // Median angle over stable endpoint window
  stableFrameCount: number;
  confidence: number;      // Avg landmark confidence during endpoint
  frameRange: [number, number];
}

interface FrameData {
  angle: number;
  confidence: number;
  frameId: number;
}

/**
 * Detects endpoints in movement by analyzing stable windows of frames.
 */
export class EndpointDetector {
  private frames: FrameData[] = [];
  
  /**
   * Adds a new frame of data for endpoint detection.
   * @param angle The angle for this frame.
   * @param confidence The confidence score for this frame.
   * @param frameId The frame identifier.
   */
  public addFrame(angle: number, confidence: number, frameId: number): void {
    this.frames.push({ angle, confidence, frameId });
  }

  /**
   * Detects an endpoint based on collected frame data.
   * @param velocityThreshold The maximum allowable angle change between frames to be considered stable.
   * @param minStableFrames The minimum number of contiguous stable frames required.
   * @param minConfidence The minimum confidence score required for a frame to be considered valid.
   * @returns The detected endpoint result, or null if no endpoint was found.
   */
  public detectEndpoint(velocityThreshold: number, minStableFrames: number, minConfidence: number): EndpointResult | null {
    if (this.frames.length < minStableFrames) {
      return null;
    }

    let stableStartIdx = -1;
    let currentStableCount = 0;
    
    // Find the longest stable window
    let bestWindow: FrameData[] = [];

    for (let i = 1; i < this.frames.length; i++) {
      const prev = this.frames[i - 1];
      const curr = this.frames[i];

      const velocity = Math.abs(curr.angle - prev.angle);
      
      const isValid = velocity < velocityThreshold && 
                      curr.confidence > minConfidence && 
                      prev.confidence > minConfidence;

      if (isValid) {
        if (currentStableCount === 0) {
          stableStartIdx = i - 1;
          currentStableCount = 2; // includes prev and curr
        } else {
          currentStableCount++;
        }

        if (currentStableCount >= minStableFrames) {
          const candidateWindow = this.frames.slice(stableStartIdx, i + 1);
          if (candidateWindow.length > bestWindow.length) {
            bestWindow = candidateWindow;
          }
        }
      } else {
        currentStableCount = 0;
      }
    }

    if (bestWindow.length >= minStableFrames) {
      const angles = bestWindow.map(f => f.angle).sort((a, b) => a - b);
      const mid = Math.floor(angles.length / 2);
      const median = angles.length % 2 !== 0 ? angles[mid] : (angles[mid - 1] + angles[mid]) / 2.0;
      
      const avgConfidence = bestWindow.reduce((sum, f) => sum + f.confidence, 0) / bestWindow.length;
      
      return {
        value: median,
        stableFrameCount: bestWindow.length,
        confidence: avgConfidence,
        frameRange: [bestWindow[0].frameId, bestWindow[bestWindow.length - 1].frameId]
      };
    }

    return null;
  }

  /**
   * Resets the accumulated frame data.
   */
  public reset(): void {
    this.frames = [];
  }
}
