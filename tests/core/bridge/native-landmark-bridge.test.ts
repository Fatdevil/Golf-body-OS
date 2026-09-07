import { 
  convertNativeResultToPoseFrame, 
  validateModelIntegrity, 
  EXPECTED_MODEL_SHA256, 
  NativeBridgeError 
} from '../../../src/core/bridge/native-landmark-bridge';
import { NativeLandmarkResult, NativeModelInfo } from '../../../../modules/golf-body-pose'; // Mock or adapt

function generateValidFlatArray(): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 33; i++) {
    arr.push(i, 0.5, 0.5, 0.1, 0.9, 0.9);
  }
  return arr;
}

describe('native-landmark-bridge', () => {
  const modelInfo: NativeModelInfo = {
    model: 'pose_landmarker_full.task',
    version: '1.0',
    variant: 'FULL',
    sha256: EXPECTED_MODEL_SHA256
  };

  const createBaseResult = (landmarks: number[]): NativeLandmarkResult => ({
    landmarks,
    worldLandmarks: [],
    timestampMs: 1000,
    width: 1920,
    height: 1080
  });

  it('valid 198-element array converts correctly', () => {
    const validArray = generateValidFlatArray();
    const result = convertNativeResultToPoseFrame(createBaseResult(validArray), modelInfo, 1);
    expect(result.landmarks.length).toBe(33);
    expect(result.landmarks[0].id).toBe(0);
    expect(result.landmarks[32].id).toBe(32);
  });

  it('invalid length throws INVALID_NATIVE_POSE_PAYLOAD', () => {
    const arr197 = generateValidFlatArray().slice(0, 197);
    expect(() => convertNativeResultToPoseFrame(createBaseResult(arr197), modelInfo, 1))
      .toThrowError(NativeBridgeError);
    
    expect(() => convertNativeResultToPoseFrame(createBaseResult([]), modelInfo, 1))
      .toThrowError(NativeBridgeError);
  });

  it('NaN in landmarks throws INVALID_NATIVE_POSE_PAYLOAD', () => {
    const arr = generateValidFlatArray();
    arr[1] = NaN; // Set x to NaN
    expect(() => convertNativeResultToPoseFrame(createBaseResult(arr), modelInfo, 1))
      .toThrowError(NativeBridgeError);
  });

  it('Infinity in landmarks throws INVALID_NATIVE_POSE_PAYLOAD', () => {
    const arr = generateValidFlatArray();
    arr[2] = Infinity; // Set y to Infinity
    expect(() => convertNativeResultToPoseFrame(createBaseResult(arr), modelInfo, 1))
      .toThrowError(NativeBridgeError);
  });

  it('Duplicate landmark IDs throws INVALID_NATIVE_POSE_PAYLOAD', () => {
    const arr = generateValidFlatArray();
    arr[6] = 0; // Replace second landmark ID with 0
    expect(() => convertNativeResultToPoseFrame(createBaseResult(arr), modelInfo, 1))
      .toThrowError(NativeBridgeError);
  });

  it('Model integrity check passes with correct SHA', () => {
    expect(validateModelIntegrity(EXPECTED_MODEL_SHA256)).toBe(true);
  });

  it('Model integrity check fails with wrong SHA', () => {
    expect(validateModelIntegrity('wrong-sha')).toBe(false);
  });
});
