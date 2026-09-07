# Golden Video Dataset

## Purpose

This directory contains the **manifest** for golden test videos used to validate and regress the Golf Body OS measurement pipeline. The actual video files are stored in **private external storage** — not in this Git repository.

## Privacy Requirements

- All participants **must** provide written informed consent before recording.
- Videos are identified by `participantId` (anonymous identifier), never by name.
- Each video has a `consentRecordId` linking to the consent documentation.
- Each video has a `retentionExpiryDate` — videos must be deleted when expired.
- Access is restricted to authorized development team members.

## Manifest Format

The `dataset-manifest.json` file tracks:

| Field | Description |
|---|---|
| `videoId` | Unique identifier (e.g., `GV001`) |
| `participantId` | Anonymous participant ID |
| `protocol` | Test protocol (e.g., `HIP_HINGE_V1`) |
| `sha256` | SHA-256 hash of the video file |
| `resolution` | Video resolution (e.g., `1920x1080`) |
| `fps` | Frame rate |
| `durationMs` | Duration in milliseconds |
| `storageUri` | Reference to private storage location |
| `expectedOutputs` | Expected metric values with tolerances |
| `consentRecordId` | Reference to consent documentation |
| `captureDate` | ISO date of recording |
| `retentionExpiryDate` | When the video must be deleted |

## Adding Videos

1. Record the video following the test protocol instructions.
2. Obtain written consent from the participant.
3. Upload to private storage.
4. Add entry to `dataset-manifest.json` with all required metadata.
5. Run the pipeline against the video and record expected outputs.

## Usage in CI

Regression tests load the manifest, download videos from private storage (with auth), run the pipeline, and compare results against `expectedOutputs`.

## What IS in Git

- `dataset-manifest.json` — Metadata only
- `../tests/fixtures/*.json` — Synthetic landmark sequences (no real humans)
