import { AiCoachService } from "../../src/core/ai/ai-coach-service";
import { report } from "./fixtures";
let previousFetch: typeof fetch;
beforeEach(() => {
  previousFetch = global.fetch;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = previousFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
function service() {
  return new AiCoachService({ apiKey: "test-only-not-a-secret" });
}
function response(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}
test.each([429, 500, 503])(
  "A01 HTTP %s falls back with explicit local source",
  async (status) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status,
        text: async () => "simulated error",
      });
    expect((await service().generateAnalysis(report(), [])).engineUsed).toBe(
      "LOCAL_EXPERT_SYNTHESIZER",
    );
  },
);
test("A02 network failure uses local fallback", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
  expect((await service().generateAnalysis(report(), [])).engineUsed).toBe(
    "LOCAL_EXPERT_SYNTHESIZER",
  );
});
test("A03 invalid JSON uses local fallback", async () => {
  global.fetch = jest.fn().mockResolvedValue(response("{invalid"));
  expect((await service().generateAnalysis(report(), [])).engineUsed).toBe(
    "LOCAL_EXPERT_SYNTHESIZER",
  );
});
test("A04 valid JSON missing required result fields must use local fallback", async () => {
  global.fetch = jest.fn().mockResolvedValue(response("{}"));
  expect((await service().generateAnalysis(report(), [])).engineUsed).toBe(
    "LOCAL_EXPERT_SYNTHESIZER",
  );
});
test("A05 wrong field types must not escape as a remote analysis", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      response(
        JSON.stringify({
          headline: 42,
          summary: [],
          exercises: "invalid",
          golfTranslation: null,
        }),
      ),
    );
  expect((await service().generateAnalysis(report(), [])).engineUsed).toBe(
    "LOCAL_EXPERT_SYNTHESIZER",
  );
});
test("A06 a stalled request settles within a proposed 30-second customer timeout", async () => {
  jest.useFakeTimers();
  let release: any;
  global.fetch = jest.fn(
    () =>
      new Promise<any>((r) => {
        release = r;
      }),
  );
  let settled = false;
  const pending = service()
    .generateAnalysis(report(), [])
    .then(() => {
      settled = true;
    });
  await jest.advanceTimersByTimeAsync(30000);
  const settledByDeadline = settled;
  release(response("{invalid"));
  await pending;
  expect(settledByDeadline).toBe(true);
});
