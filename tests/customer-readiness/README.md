# Customer readiness acceptance tests — 2026-09-29

Baseline: `409d4200f2f533d96262322ca36a9a99bceb9499`.

These are ordinary acceptance tests, not `test.failing`, skipped tests, or assertions
that treat known defects as correct. They were written against the baseline above,
where 21 of 58 cases failed; the product defects they exposed have since been fixed
and every case now passes. Do not weaken assertions or lower thresholds to pass.

## Reproduce

Use Node 22.13+, then from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npx jest tests/customer-readiness --runInBand
npm run test:coverage -- --runInBand
```

The configured global coverage threshold (80%) was already unmet on the baseline
and is still unmet; `test:coverage` therefore exits nonzero independently of
these tests.

## Findings and fixes

| ID  | Finding on baseline                                                                    | Fix                                                                                  |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| M01 | Live measurement accepted FAILED/ABSTAINED pipeline results with residual repetitions. | `LiveScreeningSession.finalizeHinge` returns a measurement only for `SUCCESS`.       |
| M02 | Scoring marked a failed/abstained report's hinge pillar as measured.                   | `calculateGolfBodyScore` requires `status === 'SUCCESS'`.                            |
| M03 | Reversed horizontal shoulder pair reported 180° tilt instead of zero.                  | `calculateFrontalTilt` is independent of which image side each shoulder is on.       |
| M04 | Live rotation accepted landmarks with visibility/presence 0.01.                        | Rotation samples require `minLandmarkConfidence` on shoulders and hips.              |
| M05 | NaN confidence input did not abstain.                                                  | Non-finite inputs score 0, are flagged `INVALID_INPUT` and abstain.                  |
| M10 | Repetition consistency was hard-coded to 1.0.                                          | Computed as 1 − CV of hinge ROM across repetitions.                                  |
| C01 | A 250 ms startup gap prevented timestamp unit inference forever.                       | Unit is inferred from consecutive frame intervals, not from the first frame.         |
| C05 | Duplicate/backward source timestamps were emitted.                                     | Normalizer output is strictly increasing; such frames are dropped.                   |
| S03 | Failed overwrite left the changed score in the cache.                                  | Cache is replaced only after a successful write.                                     |
| S04 | Failed insert into a full history lost an old cached entry.                            | Same as S03.                                                                         |
| S05 | Failed deletion was silently swallowed.                                                | `clearHistory` rejects; the context shows the error in history.                      |
| S06 | Structurally corrupt stored records could crash sorting.                               | Invalid records are dropped on load; missing optional lists get defaults.            |
| A04 | Empty JSON object accepted as remote AI result.                                        | Gemini responses are validated against `AiCoachAnalysis`; invalid → local fallback.  |
| A05 | Wrong JSON field types accepted as remote AI result.                                   | Same as A04.                                                                         |
| A06 | Stalled AI request never settled.                                                      | Gemini requests time out after `AI_REQUEST_TIMEOUT_MS` (30 s) and fall back locally. |
| U04 | Simulated history entry had no visible demo label.                                     | History shows a `SIMULERAT` badge.                                                   |
| U05 | Persistence failure was not visible in the result view.                                | Context exposes `storageError`; result view shows a banner.                          |

A06's 30-second limit is a proposed acceptance criterion, not an existing documented SLA.

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
