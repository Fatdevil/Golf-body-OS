import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import {
  ScreeningProvider,
  useScreening,
} from "../../src/context/ScreeningContext";
import ScreeningResultScreen from "../../src/screens/screening/ScreeningResultScreen";
import HistoryScreen from "../../src/screens/history/HistoryScreen";
import { screeningRepository } from "../../src/storage/screening-repository";
import { stored } from "./fixtures";
let context: ReturnType<typeof useScreening>;
function Probe() {
  context = useScreening();
  return null;
}
beforeEach(() => {
  jest.spyOn(screeningRepository, "getSessions").mockResolvedValue([]);
  jest
    .spyOn(screeningRepository, "saveSession")
    .mockResolvedValue({ success: true });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test("U01 start and cancel screening reset workflow", async () => {
  await render(
    <ScreeningProvider>
      <Probe />
    </ScreeningProvider>,
  );
  await act(() => context.startScreening("HIP_HINGE"));
  expect(context.activeScreeningStep).toBe("RUNNER");
  expect(context.activeTestType).toBe("HIP_HINGE");
  await act(() => context.cancelScreening());
  expect(context.activeScreeningStep).toBe("SELECT");
  expect(context.currentResult).toBeNull();
});
test("U02 empty result view gives a readable recovery action", async () => {
  const view = await render(
    <ScreeningProvider>
      <Probe />
      <ScreeningResultScreen />
    </ScreeningProvider>,
  );
  expect(view.getByText("Inget resultat tillgängligt")).toBeTruthy();
  await fireEvent.press(view.getByText("Tillbaka till Dashboard"));
  expect(context.activeTab).toBe("DASHBOARD");
});
test("U03 simulated result is clearly labelled", async () => {
  const view = await render(
    <ScreeningProvider>
      <Probe />
      <ScreeningResultScreen />
    </ScreeningProvider>,
  );
  await act(() => context.setCurrentResult({ ...stored(), isSimulated: true }));
  expect(view.getByText(/SIMULERAT RESULTAT/)).toBeTruthy();
});
test("U04 simulated result is also labelled in history", async () => {
  jest
    .mocked(screeningRepository.getSessions)
    .mockResolvedValue([{ ...stored(), isSimulated: true }]);
  const view = await render(
    <ScreeningProvider>
      <HistoryScreen />
    </ScreeningProvider>,
  );
  expect(view.queryByText(/simulerat|demo/i)).not.toBeNull();
});
test("U05 disk failure is visible in customer result view", async () => {
  jest
    .mocked(screeningRepository.saveSession)
    .mockResolvedValue({ success: false, error: "disk full" });
  const view = await render(
    <ScreeningProvider>
      <Probe />
      <ScreeningResultScreen />
    </ScreeningProvider>,
  );
  await act(async () => {
    await context.finishScreening(stored());
  });
  expect(
    view.queryByText(
      /kunde inte sparas|inte sparat|sparandet misslyckades|not saved|could not be saved/i,
    ),
  ).not.toBeNull();
});
test("U06 successful completion persists and shows measured result", async () => {
  const view = await render(
    <ScreeningProvider>
      <Probe />
      <ScreeningResultScreen />
    </ScreeningProvider>,
  );
  await act(async () => {
    await context.finishScreening(stored());
  });
  expect(screeningRepository.saveSession).toHaveBeenCalledWith(stored());
  expect(context.activeScreeningStep).toBe("RESULT");
  expect(view.getByText("SCREENINGRESULTAT")).toBeTruthy();
});
