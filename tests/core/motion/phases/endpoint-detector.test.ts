import { EndpointDetector } from '../../../../src/core/motion/phases/endpoint-detector';

describe('EndpointDetector', () => {
  let detector: EndpointDetector;

  beforeEach(() => {
    detector = new EndpointDetector();
  });

  it('should return null for insufficient frames', () => {
    detector.addFrame(90, 0.9, 1);
    expect(detector.detectEndpoint(5, 3, 0.8)).toBeNull();
  });

  it('should compute median over stable window', () => {
    detector.addFrame(90, 0.9, 1);
    detector.addFrame(92, 0.9, 2);
    detector.addFrame(91, 0.9, 3);
    detector.addFrame(93, 0.9, 4);

    const result = detector.detectEndpoint(5, 3, 0.8);
    expect(result).not.toBeNull();
    // values sorted: 90, 91, 92, 93 -> median is (91+92)/2 = 91.5
    expect(result!.value).toBe(91.5);
    expect(result!.stableFrameCount).toBe(4);
    expect(result!.frameRange).toEqual([1, 4]);
  });

  it('should ignore low confidence frames', () => {
    detector.addFrame(90, 0.9, 1);
    detector.addFrame(91, 0.9, 2);
    detector.addFrame(92, 0.5, 3); // low confidence
    detector.addFrame(93, 0.9, 4);

    const result = detector.detectEndpoint(5, 3, 0.8);
    expect(result).toBeNull(); // longest valid window is 2, min requires 3
  });

  it('should reset properly', () => {
    detector.addFrame(90, 0.9, 1);
    detector.addFrame(91, 0.9, 2);
    detector.addFrame(90, 0.9, 3);
    expect(detector.detectEndpoint(5, 3, 0.8)).not.toBeNull();
    
    detector.reset();
    expect(detector.detectEndpoint(5, 3, 0.8)).toBeNull();
  });
});
