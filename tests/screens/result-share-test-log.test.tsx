import React from "react";
import { Share } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";
import {
  ScreeningProvider,
  useScreening,
} from "../../src/context/ScreeningContext";
import ScreeningResultScreen from "../../src/screens/screening/ScreeningResultScreen";
import { screeningRepository } from "../../src/storage/screening-repository";
import { ScreeningDiagnosticsRecorder } from "../../src/core/diagnostics/screening-diagnostics";
import { stored } from "../customer-readiness/fixtures";

let context: ReturnType<typeof useScreening>;
function Probe() {
  context = useScreening();
  return null;
}

beforeEach(() => {
  jest.spyOn(screeningRepository, "getSessions").mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

async function renderResult() {
  return render(
    <ScreeningProvider>
      <Probe />
      <ScreeningResultScreen />
    </ScreeningProvider>,
  );
}

test("shares the run diagnostics as text from the result screen", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: "sharedAction" } as any);
  const diagnostics = new ScreeningDiagnosticsRecorder("HIP_HINGE").build({
    isSimulated: false,
    device: { os: "android", osVersion: "35" },
    processorStats: {
      received: 10,
      droppedBusy: 2,
      noPerson: 1,
      errors: 0,
      emitted: 7,
    },
  });
  const view = await renderResult();
  await act(() => context.setCurrentResult({ ...stored(), diagnostics }));

  await fireEvent.press(view.getByText(/Dela testlogg/));

  expect(share).toHaveBeenCalledTimes(1);
  const message = share.mock.calls[0]![0].message!;
  expect(message).toContain("Golf Body OS – testlogg (HIP_HINGE");
  expect(JSON.parse(message.slice(message.indexOf("{")))).toEqual(diagnostics);
});

test("hides the button for sessions saved without a test log", async () => {
  const view = await renderResult();
  await act(() => context.setCurrentResult(stored()));
  expect(view.queryByText(/Dela testlogg/)).toBeNull();
});
