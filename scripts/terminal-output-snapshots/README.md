# Terminal output snapshots

This directory stores baseline snapshots of normalized terminal output in plain text.
Each snapshot captures combined stdout/stderr from Storybook build/dev commands after volatile values are normalized.

## Snapshot format

- Format: plain text (`.snap.txt`)
- Content: normalized terminal output (one line per captured output line)
- Filename convention: `<builder-name>-<mode>.snap.txt`

## Normalization rules

The capture script strips or normalizes volatile output so snapshots remain stable between runs:

- Absolute paths under the repo root are replaced with `<ROOT>`
- Any other absolute paths (`/Users/...`, `/home/...`, `/tmp/...`) are replaced with `<ROOT>`
- ISO timestamps are replaced with `<TIMESTAMP>`
- `HH:MM:SS` time values are replaced with `<TIME>`
- URL ports (`localhost:6006`) are normalized to `localhost:<PORT>`
- Bare port log references (`port 6006`, `on port 6006`) are normalized to `port <PORT>`
- Process IDs (`pid: 12345`, `PID 12345`) are normalized to `pid: <PID>`
- Build durations (`built in 1.23s`, `in 456ms`, `done in 1.2 s`) are normalized to `built in <DURATION>`
- Hash segments in filenames (`main.a1b2c3d4.js`, `chunk-abc123.js`) are normalized to `<HASH>`
- Memory usage lines (`heap used: 123 MB`) are normalized to `heap used: <MEMORY>`
- ANSI escape sequences are stripped

## Provisional baseline protocol

When no baseline exists and the script runs without `--update`, it creates a provisional baseline.
Provisional files are prefixed with:

`# PROVISIONAL BASELINE — requires reviewer approval before merge`

This provisional baseline must be explicitly reviewed and approved before merge.

## Updating a baseline

Run:

`jiti scripts/capture-terminal-output.ts --builder <name> --mode <build|dev> --update`
