# Verification Artifacts

This directory contains verification evidence (screenshots, snapshots, etc.) generated during bug fix verification workflows.

## Directory Structure

```
verification/
├── screenshots/
│   ├── flow-1/              # Renderer bug verification
│   │   ├── issue-12345/     # Screenshots for issue #12345
│   │   │   ├── before-fix.png
│   │   │   └── after-fix.png
│   │   └── issue-12346/
│   ├── flow-2/              # Builder frontend output verification
│   │   ├── issue-12347/
│   │   │   ├── before-fix.png
│   │   │   └── after-fix.png
│   │   └── ...
│   ├── flow-3/              # Builder terminal output verification (usually just diffs)
│   │   └── ...
│   └── flow-4/              # Manager UI bug verification
│       ├── issue-12350/
│       │   ├── before-fix.png
│       │   └── after-fix.png
│       └── ...
```

## What Are These?

- **Screenshots** (`flow-1, flow-2, flow-4`): Visual evidence of bugs being fixed
  - `before-fix.png` → Screenshot showing the broken behavior
  - `after-fix.png` → Screenshot showing the fixed behavior

- **Snapshots** (`flow-3`): Terminal output diffs and build snapshots used to verify builder fixes

## When Are These Created?

These files are created by the verification workflows during bug fix execution:

- `/renderer-bug-workflow` → `flow-1/`
- `/builder-bug-workflow` (Flow 2) → `flow-2/`
- `/builder-bug-workflow` (Flow 3) → `flow-3/`
- `/manager-bug-workflow` → `flow-4/`

## Git Tracking

All verification artifacts are **committed to git** as part of the bug fix PR:

```bash
git add verification/
git commit -m "Test(verif): Issue #12345 — Verification evidence (Flow X)"
```

This allows reviewers to see the exact evidence that was used to verify the fix.

## Cleaning Up

After a PR is merged, the verification artifacts remain in the repository for historical reference and audit purposes. No cleanup is required.
