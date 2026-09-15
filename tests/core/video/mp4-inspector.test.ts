import { Mp4Inspector } from '../../../src/core/video/mp4-inspector';

describe('Mp4Inspector', () => {
  describe('roundToStandardFps', () => {
    it('correctly rounds common standard and broadcast framerates', () => {
      expect(Mp4Inspector.roundToStandardFps(29.97)).toBe(30);
      expect(Mp4Inspector.roundToStandardFps(30.0)).toBe(30);
      expect(Mp4Inspector.roundToStandardFps(59.94)).toBe(60);
      expect(Mp4Inspector.roundToStandardFps(60.0)).toBe(60);
      expect(Mp4Inspector.roundToStandardFps(119.88)).toBe(120);
      expect(Mp4Inspector.roundToStandardFps(120.0)).toBe(120);
      expect(Mp4Inspector.roundToStandardFps(239.76)).toBe(240);
      expect(Mp4Inspector.roundToStandardFps(240.0)).toBe(240);
      expect(Mp4Inspector.roundToStandardFps(23.976)).toBe(24);
      expect(Mp4Inspector.roundToStandardFps(25.0)).toBe(25);
    });
  });

  describe('inspectBuffer', () => {
    it('returns null for empty or invalid buffer', () => {
      const empty = new ArrayBuffer(0);
      expect(Mp4Inspector.inspectBuffer(empty)).toBeNull();

      const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      expect(Mp4Inspector.inspectBuffer(garbage)).toBeNull();
    });

    /**
     * Helper to create a binary MP4 box: [uint32 size, 4-char type, payload...]
     */
    function makeBox(type: string, payload: Uint8Array): Uint8Array {
      const size = 8 + payload.length;
      const res = new Uint8Array(size);
      const view = new DataView(res.buffer);
      view.setUint32(0, size);
      for (let i = 0; i < 4; i++) {
        res[4 + i] = type.charCodeAt(i);
      }
      res.set(payload, 8);
      return res;
    }

    function concat(...arrays: Uint8Array[]): Uint8Array {
      const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
      const res = new Uint8Array(totalLen);
      let offset = 0;
      for (const a of arrays) {
        res.set(a, offset);
        offset += a.length;
      }
      return res;
    }

    function buildSyntheticMp4(fps: number, durationSec: number, width = 1080, height = 1920): ArrayBuffer {
      const timescale = 60000;
      const sampleDelta = Math.round(timescale / fps);
      const totalFrames = Math.round(fps * durationSec);
      const duration = Math.round(timescale * durationSec);

      // 1. ftyp box
      const ftypPayload = new Uint8Array([
        'i'.charCodeAt(0), 's'.charCodeAt(0), 'o'.charCodeAt(0), 'm'.charCodeAt(0),
        0, 0, 2, 0,
        'm'.charCodeAt(0), 'p'.charCodeAt(0), '4'.charCodeAt(0), '1'.charCodeAt(0)
      ]);
      const ftypBox = makeBox('ftyp', ftypPayload);

      // 2. tkhd box (width and height fixed point 16.16)
      const tkhdPayload = new Uint8Array(84);
      const tkhdView = new DataView(tkhdPayload.buffer);
      tkhdView.setUint8(0, 0); // version 0
      tkhdView.setUint32(76, width << 16); // width at offset 76
      tkhdView.setUint32(80, height << 16); // height at offset 80
      const tkhdBox = makeBox('tkhd', tkhdPayload);

      // 3. hdlr box with 'vide'
      const hdlrPayload = new Uint8Array(24);
      const hdlrView = new DataView(hdlrPayload.buffer);
      hdlrView.setUint32(0, 0); // version & flags
      // component subtype 'vide' at offset 8
      hdlrPayload[8] = 'v'.charCodeAt(0);
      hdlrPayload[9] = 'i'.charCodeAt(0);
      hdlrPayload[10] = 'd'.charCodeAt(0);
      hdlrPayload[11] = 'e'.charCodeAt(0);
      const hdlrBox = makeBox('hdlr', hdlrPayload);

      // 4. mdhd box (timescale & duration)
      const mdhdPayload = new Uint8Array(24);
      const mdhdView = new DataView(mdhdPayload.buffer);
      mdhdView.setUint8(0, 0); // version 0
      mdhdView.setUint32(12, timescale); // timescale at offset 12
      mdhdView.setUint32(16, duration); // duration at offset 16
      const mdhdBox = makeBox('mdhd', mdhdPayload);

      // 5. stts box (time-to-sample)
      const sttsPayload = new Uint8Array(16);
      const sttsView = new DataView(sttsPayload.buffer);
      sttsView.setUint8(0, 0); // version 0
      sttsView.setUint32(4, 1); // 1 entry
      sttsView.setUint32(8, totalFrames); // sample_count
      sttsView.setUint32(12, sampleDelta); // sample_delta
      const sttsBox = makeBox('stts', sttsPayload);

      // 6. stsz box (sample count)
      const stszPayload = new Uint8Array(12);
      const stszView = new DataView(stszPayload.buffer);
      stszView.setUint8(0, 0);
      stszView.setUint32(4, 0); // variable size
      stszView.setUint32(8, totalFrames); // sample_count
      const stszBox = makeBox('stsz', stszPayload);

      // stbl box wraps stts and stsz
      const stblBox = makeBox('stbl', concat(sttsBox, stszBox));

      // minf box wraps stbl
      const minfBox = makeBox('minf', stblBox);

      // mdia box wraps hdlr, mdhd, minf
      const mdiaBox = makeBox('mdia', concat(hdlrBox, mdhdBox, minfBox));

      // trak box wraps tkhd, mdia
      const trakBox = makeBox('trak', concat(tkhdBox, mdiaBox));

      // moov box wraps trak
      const moovBox = makeBox('moov', trakBox);

      return concat(ftypBox, moovBox).buffer;
    }

    it('correctly inspects a 30 fps standard video', () => {
      const buffer = buildSyntheticMp4(30, 2.5, 1080, 1920);
      const meta = Mp4Inspector.inspectBuffer(buffer);

      expect(meta).not.toBeNull();
      expect(meta!.nominalFps).toBe(30);
      expect(meta!.totalFrames).toBe(75);
      expect(meta!.durationSec).toBe(2.5);
      expect(meta!.width).toBe(1080);
      expect(meta!.height).toBe(1920);
      expect(meta!.isSlowMotion).toBe(false);
      expect(meta!.slowMotionFactor).toBe(1);
    });

    it('correctly inspects a 60 fps video', () => {
      const buffer = buildSyntheticMp4(60, 3.0);
      const meta = Mp4Inspector.inspectBuffer(buffer);

      expect(meta).not.toBeNull();
      expect(meta!.nominalFps).toBe(60);
      expect(meta!.totalFrames).toBe(180);
      expect(meta!.durationSec).toBe(3.0);
      expect(meta!.isSlowMotion).toBe(true);
      expect(meta!.slowMotionFactor).toBe(2);
    });

    it('correctly inspects a 120 fps slow-motion video (4x)', () => {
      const buffer = buildSyntheticMp4(120, 2.0);
      const meta = Mp4Inspector.inspectBuffer(buffer);

      expect(meta).not.toBeNull();
      expect(meta!.nominalFps).toBe(120);
      expect(meta!.totalFrames).toBe(240);
      expect(meta!.isSlowMotion).toBe(true);
      expect(meta!.slowMotionFactor).toBe(4);
    });

    it('correctly inspects a 240 fps slow-motion video (8x)', () => {
      const buffer = buildSyntheticMp4(240, 1.5);
      const meta = Mp4Inspector.inspectBuffer(buffer);

      expect(meta).not.toBeNull();
      expect(meta!.nominalFps).toBe(240);
      expect(meta!.totalFrames).toBe(360);
      expect(meta!.isSlowMotion).toBe(true);
      expect(meta!.slowMotionFactor).toBe(8);
    });
  });
});
