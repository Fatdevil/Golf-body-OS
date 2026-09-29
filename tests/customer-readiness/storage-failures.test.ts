const mockDisk = {
  text: null as string | null,
  failWrite: false,
  failDelete: false,
};
jest.mock("expo-file-system", () => ({
  Paths: { document: "test" },
  File: class {
    get exists() {
      return mockDisk.text !== null;
    }
    textSync() {
      return mockDisk.text;
    }
    write(s: string) {
      if (mockDisk.failWrite) throw new Error("disk full");
      mockDisk.text = s;
    }
    delete() {
      if (mockDisk.failDelete) throw new Error("denied");
      mockDisk.text = null;
    }
  },
}));
import { ScreeningRepository } from "../../src/storage/screening-repository";
import { stored } from "./fixtures";
beforeEach(() => {
  mockDisk.text = null;
  mockDisk.failWrite = false;
  mockDisk.failDelete = false;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test("S01 saved session survives repository restart", async () => {
  const r = new ScreeningRepository();
  expect((await r.saveSession(stored())).success).toBe(true);
  expect(await new ScreeningRepository().getLatestSession()).toEqual(stored());
});
test("S02 failed new insert returns failure without a phantom cached session", async () => {
  const r = new ScreeningRepository();
  mockDisk.failWrite = true;
  expect((await r.saveSession(stored())).success).toBe(false);
  expect(await r.getSessions()).toEqual([]);
});
test("S03 failed overwrite restores previous cached value", async () => {
  const r = new ScreeningRepository();
  await r.saveSession(stored("s1", 65));
  mockDisk.failWrite = true;
  expect((await r.saveSession(stored("s1", 99))).success).toBe(false);
  expect((await r.getLatestSession())!.golfBodyScore).toBe(65);
});
test("S04 failed insert into full history preserves all previous sessions", async () => {
  const r = new ScreeningRepository();
  for (let i = 0; i < 50; i++) await r.saveSession(stored("s" + i));
  const before = await r.getSessions();
  mockDisk.failWrite = true;
  expect((await r.saveSession(stored("new"))).success).toBe(false);
  expect(await r.getSessions()).toEqual(before);
});
test("S05 failed delete is surfaced to caller instead of reporting success", async () => {
  const r = new ScreeningRepository();
  await r.saveSession(stored());
  mockDisk.failDelete = true;
  await expect(r.clearHistory()).rejects.toThrow();
});
test("S06 structurally invalid stored records are not exposed to UI", async () => {
  mockDisk.text = JSON.stringify([null, { id: "broken" }]);
  const r = new ScreeningRepository();
  expect(await r.getSessions()).toEqual([]);
});
test("S07 invalid JSON does not crash loading", async () => {
  mockDisk.text = "{broken";
  expect(await new ScreeningRepository().getSessions()).toEqual([]);
});
test("S08 successful deletion remains deleted after restart", async () => {
  const r = new ScreeningRepository();
  await r.saveSession(stored());
  await r.clearHistory();
  expect(await new ScreeningRepository().getSessions()).toEqual([]);
});
