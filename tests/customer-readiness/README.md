# Customer readiness acceptance tests — 2026-09-29

Baseline: `409d4200f2f533d96262322ca36a9a99bceb9499`.

This is a **test-only diagnostic branch**. No application implementation changes.
These are ordinary acceptance tests, not `test.failing`, skipped tests, or assertions
that treat known defects as correct. **Do not merge as a green release gate yet.**

## Reproduce

Use Node 22.13+ (this run: Node 24.19.0), then from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npx jest tests/customer-readiness --runInBand
npm run test:coverage -- --runInBand
```

The test and coverage commands currently return nonzero by design: the product
fails the asserted acceptance conditions. Fix production code, then rerun these
same assertions. Do not lower coverage thresholds or weaken assertions to pass.

## Results

- Existing tests: **324/324 pass**.
- New tests: **37 pass, 21 fail, 58 total**.
- Combined: **361 pass, 21 fail, 382 total**, 53 suites.
- Lines: 74.68%; branches: 61.07%; functions: 68.52%; statements: 73.26%.
- Configured global coverage threshold: 80% for all four categories, not met.
- Exact per-case results: `results-2026-09-29.json` (snapshot, not a live gate).

## Failing acceptance conditions

| ID  | Cases failing | Finding                                                                                                      |
| --- | ------------: | ------------------------------------------------------------------------------------------------------------ |
| M01 |             2 | Live measurement accepts FAILED/ABSTAINED pipeline results with residual repetitions.                        |
| M02 |             2 | Scoring marks a failed/abstained report's hinge pillar as measured.                                          |
| M03 |             1 | Reversed horizontal shoulder pair reports 180 degrees tilt instead of zero.                                  |
| M04 |             1 | Live rotation accepts landmarks with visibility/presence 0.01.                                               |
| M05 |             1 | NaN confidence input does not abstain.                                                                       |
| M10 |             1 | Nine synthetic reps at substantially different depths still feed repetition consistency 1.0 into confidence. |
| C01 |             3 | 250ms startup gap prevents recovery for millisecond, microsecond and nanosecond inputs.                      |
| C05 |             1 | Duplicate/backward source timestamps are emitted as duplicate/backward measurement times.                    |
| S03 |             1 | Failed overwrite leaves the changed cached score despite persistence failure.                                |
| S04 |             1 | Failed insert into a full 50-session history loses an old cached entry.                                      |
| S05 |             1 | Failed deletion resolves normally and is not surfaced to the caller.                                         |
| S06 |             1 | Structurally corrupt stored records can crash sorting.                                                       |
| A04 |             1 | Empty JSON object accepted as remote AI result.                                                              |
| A05 |             1 | Wrong JSON field types accepted as remote AI result.                                                         |
| A06 |             1 | Stalled AI request exceeds a proposed 30-second customer timeout.                                            |
| U04 |             1 | Simulated history entry has no visible demo label.                                                           |
| U05 |             1 | Persistence failure not visible in customer result view.                                                     |

A06's 30-second limit is a proposed acceptance criterion, not an existing documented SLA.
S05 specifies rejection for the existing Promise<void> API; an explicit typed failure
result plus updated callers would be another valid design and require an adjusted test.

## What the tests actually exercise

- M06/M07/M08/M09 and M10 run the real temporal pipeline with synthetic image-space
  landmarks. M01 deliberately injects failure at the pipeline boundary to verify
  its consumer. These tests do not validate MediaPipe inference or clinical accuracy.
- Camera tests execute real JS processor logic with an injected native detector.
- Storage tests execute the real repository in disk mode using an in-memory File
  adapter with injected I/O failures. They do not prove OS filesystem atomicity.
- AI tests mock HTTP responses. No real Gemini request or billable API call occurs.
- UI tests render actual React Native result/history screens and the actual context
  provider, with the repository mocked. No real camera or mobile OS is exercised.
- Training tests run score -> profile -> plan with the real exercise library,
  12 time/focus combinations, discomfort handling, empty library and determinism.

## Build checks

PASS: TypeScript, ESLint, Expo Doctor 21/21, public Expo configuration,
Android/iOS Expo module resolution (GolfBodyPose found), Android prebuild,
Android Hermes export (814 modules), iOS Hermes export (816 modules), web build.
All three bundled MediaPipe model files match the expected SHA-256:
`5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`.

BLOCKED: Android APK build stops downloading Gradle 9.3.1 with
`java.net.SocketException: Network is unreachable`. No SDK/adb was available in
the checked standard locations/PATH. Native Kotlin/Swift compilation is NOT verified.
iOS native build needs macOS/Xcode. Production browser E2E was not executed:
Chromium was absent and Playwright's browser download failed. A web build passing
is not a browser runtime test.

## Before device acceptance

1. Fix the failed local acceptance conditions and rerun all tests.
2. Make a native build in Android Studio or a configured build environment.
3. Test a development build on a real Samsung; this native module cannot run in Expo Go.
4. Verify permission denial/retry, visible 33 landmarks, rotation/mirror correctness,
   repetition completion, interrupted sessions, restart persistence, audio coaching,
   and sustained frame latency/memory/temperature across repeated sessions.
5. Repeat the supported cases on iPhone before claiming iOS readiness.
6. Establish an independent real-video/reference dataset before claiming measurement accuracy.

No phone-only acceptance has been marked PASS.
