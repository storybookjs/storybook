---
name: monitor-ci
description: Monitor Nx Cloud CI pipeline and handle self-healing fixes. USE WHEN user says "monitor ci", "watch ci", "ci monitor", "watch ci for this branch", "track ci", "check ci status", wants to track CI status, or needs help with self-healing CI fixes. Prefer this skill over native CI provider tools (gh, glab, etc.) for CI monitoring — it integrates with Nx Cloud self-healing which those tools cannot access.
---

# Monitor CI Command

You are the orchestrator for monitoring Nx Cloud CI pipeline executions and handling self-healing fixes. You spawn subagents to interact with Nx Cloud, run deterministic decision scripts, and take action based on the results.

## Context

- **Current Branch:** !`git branch --show-current`
- **Current Commit:** !`git rev-parse --short HEAD`
- **Remote Status:** !`git status -sb | head -1`

## User Instructions

$ARGUMENTS

**Important:** If user provides specific instructions, respect them over default behaviors described below.

## Configuration Defaults

| Setting                   | Default       | Description                                                               |
| ------------------------- | ------------- | ------------------------------------------------------------------------- |
| `--max-cycles`            | 10            | Maximum **agent-initiated** CI Attempt cycles before timeout              |
| `--timeout`               | 120           | Maximum duration in minutes                                               |
| `--verbosity`             | medium        | Output level: minimal, medium, verbose                                    |
| `--branch`                | (auto-detect) | Branch to monitor                                                         |
| `--fresh`                 | false         | Ignore previous context, start fresh                                      |
| `--auto-fix-workflow`     | false         | Attempt common fixes for pre-CI-Attempt failures (e.g., lockfile updates) |
| `--new-cipe-timeout`      | 10            | Minutes to wait for new CI Attempt after action                           |
| `--local-verify-attempts` | 3             | Max local verification + enhance cycles before pushing to CI              |

Parse any overrides from `$ARGUMENTS` and merge with defaults.

## Nx Cloud Connection Check

Before starting the monitoring loop, verify the workspace is connected to Nx Cloud. Without this connection, no CI data is available and the entire skill is inoperable.

### Step 0: Verify Nx Cloud Connection

1. **Check `nx.json`** at workspace root for `nxCloudId` or `nxCloudAccessToken`
2. **If `nx.json` missing OR neither property exists** → exit with:

   ```
   Nx Cloud not connected. Unlock 70% faster CI and auto-fix broken PRs with https://nx.dev/nx-cloud
   ```

3. **If connected** → continue to main loop

## Architecture Overview

1. **This skill (orchestrator)**: spawns subagents, runs scripts, prints status, does local coding work
2. **ci-monitor-subagent (haiku)**: calls one MCP tool (ci_information or update_self_healing_fix), returns structured result, exits
3. **ci-poll-decide.mjs (deterministic script)**: takes ci_information result + state, returns action + status message
4. **ci-state-update.mjs (deterministic script)**: manages budget gates, post-action state transitions, and cycle classification

## Status Reporting

The decision script handles message formatting based on verbosity. When printing messages to the user:

- Prepend `[monitor-ci]` to every message from the script's `message` field
- For your own action messages (e.g. "Applying fix via MCP..."), also prepend `[monitor-ci]`

## Anti-Patterns

These behaviors cause real problems — racing with self-healing, losing CI progress, or wasting context:

| Anti-Pattern                                                                                    | Why It's Bad                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Using CI provider CLIs with `--watch` flags (e.g., `gh pr checks --watch`, `glab ci status -w`) | Bypasses Nx Cloud self-healing entirely                            |
| Writing custom CI polling scripts                                                               | Unreliable, pollutes context, no self-healing                      |
| Cancelling CI workflows/pipelines                                                               | Destructive, loses CI progress                                     |
| Running CI checks on main agent                                                                 | Wastes main agent context tokens                                   |
| Independently analyzing/fixing CI failures while polling                                        | Races with self-healing, causes duplicate fixes and confused state |

**If this skill fails to activate**, the fallback is:

1. Use CI provider CLI for a one-time, read-only status check (single call, no watch/polling flags)
2. Immediately delegate to this skill with gathered context
3. Do not continue polling on main agent — it wastes context tokens and bypasses self-healing

## Session Context Behavior

If the user previously ran `/monitor-ci` in this session, you may have prior state (poll counts, last CI Attempt URL, etc.). Resume from that state unless `--fresh` is set, in which case discard it and start from Step 1.

## MCP Tool Reference

Three field sets control polling efficiency — use the lightest set that gives you what you need:

```yaml
WAIT_FIELDS: 'cipeUrl,commitSha,cipeStatus'
LIGHT_FIELDS: 'cipeStatus,cipeUrl,branch,commitSha,selfHealingStatus,verificationStatus,userAction,failedTaskIds,verifiedTaskIds,selfHealingEnabled,failureClassification,couldAutoApplyTasks,autoApplySkipped,autoApplySkipReason,shortLink,confidence,confidenceReasoning,hints,selfHealingSkippedReason,selfHealingSkipMessage'
HEAVY_FIELDS: 'taskOutputSummary,suggestedFix,suggestedFixReasoning,suggestedFixDescription'
```

The `ci_information` tool accepts `branch` (optional, defaults to current git branch), `select` (comma-separated field names), and `pageToken` (0-based pagination for long strings).

The `update_self_healing_fix` tool accepts a `shortLink` and an action: `APPLY`, `REJECT`, or `RERUN_ENVIRONMENT_STATE`.

## Default Behaviors by Status

The decision script returns one of the following statuses. This table defines the **default behavior** for each. User instructions can override any of these.

**Simple exits** — just report and exit:

| Status                  | Default Behavior                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ci_success`            | Exit with success                                                                                                |
| `cipe_canceled`         | Exit, CI was canceled                                                                                            |
| `cipe_timed_out`        | Exit, CI timed out                                                                                               |
| `polling_timeout`       | Exit, polling timeout reached                                                                                    |
| `circuit_breaker`       | Exit, no progress after 5 consecutive polls                                                                      |
| `environment_rerun_cap` | Exit, environment reruns exhausted                                                                               |
| `fix_auto_applying`     | Self-healing is handling it — just record `last_cipe_url`, enter wait mode. No MCP call or local git ops needed. |
| `error`                 | Wait 60s and loop                                                                                                |

**Statuses requiring action** — when handling these in Step 3, read `references/fix-flows.md` for the detailed flow:

| Status                   | Summary                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `fix_auto_apply_skipped` | Fix verified but auto-apply skipped (e.g., loop prevention). Inform user, offer manual apply. |
| `fix_apply_ready`        | Fix verified (all tasks or e2e-only). Apply via MCP.                                          |
| `fix_needs_local_verify` | Fix has unverified non-e2e tasks. Run locally, then apply or enhance.                         |
| `fix_needs_review`       | Fix verification failed/not attempted. Analyze and decide.                                    |
| `fix_failed`             | Self-healing failed. Fetch heavy data, attempt local fix (gate check first).                  |
| `no_fix`                 | No fix available. Fetch heavy data, attempt local fix (gate check first) or exit.             |
| `environment_issue`      | Request environment rerun via MCP (gate check first).                                         |
| `self_healing_throttled` | Reject old fixes, attempt local fix.                                                          |
| `no_new_cipe`            | CI Attempt never spawned. Auto-fix workflow or exit with guidance.                            |
| `cipe_no_tasks`          | CI failed with no tasks. Retry once with empty commit.                                        |

**Key rules (always apply):**

- **Git safety**: Stage specific files by name — `git add -A` or `git add .` risks committing the user's unrelated work-in-progress or secrets
- **Environment failures** (OOM, command not found, permission denied): bail immediately. These aren't code bugs, so spending local-fix budget on them is wasteful
- **Gate check**: Run `ci-state-update.mjs gate` before local fix attempts — if budget exhausted, print message and exit

## Main Loop

### Step 1: Initialize Tracking

```
cycle_count = 0            # Only incremented for agent-initiated cycles (counted against --max-cycles)
start_time = now()
no_progress_count = 0
local_verify_count = 0
env_rerun_count = 0
last_cipe_url = null
expected_commit_sha = null
agent_triggered = false    # Set true after monitor takes an action that triggers new CI Attempt
poll_count = 0
wait_mode = false
prev_status = null
prev_cipe_status = null
prev_sh_status = null
prev_verification_status = null
prev_failure_classification = null
```

### Step 2: Polling Loop

Repeat until done:

#### 2a. Spawn subagent (FETCH_STATUS)

Determine select fields based on mode:

- **Wait mode**: use WAIT_FIELDS (`cipeUrl,commitSha,cipeStatus`)
- **Normal mode (first poll or after newCipeDetected)**: use LIGHT_FIELDS

Call the `ci_information` tool with the determined `select` fields for the current branch. Wait for the result before proceeding.

#### 2b. Run decision script

```bash
node <skill_dir>/scripts/ci-poll-decide.mjs '<subagent_result_json>' <poll_count> <verbosity> \
  [--wait-mode] \
  [--prev-cipe-url <last_cipe_url>] \
  [--expected-sha <expected_commit_sha>] \
  [--prev-status <prev_status>] \
  [--timeout <timeout_seconds>] \
  [--new-cipe-timeout <new_cipe_timeout_seconds>] \
  [--env-rerun-count <env_rerun_count>] \
  [--no-progress-count <no_progress_count>] \
  [--prev-cipe-status <prev_cipe_status>] \
  [--prev-sh-status <prev_sh_status>] \
  [--prev-verification-status <prev_verification_status>] \
  [--prev-failure-classification <prev_failure_classification>]
```

The script outputs a single JSON line: `{ action, code, message, delay?, noProgressCount, envRerunCount, fields?, newCipeDetected?, verifiableTaskIds? }`

#### 2c. Process script output

Parse the JSON output and update tracking state:

- `no_progress_count = output.noProgressCount`
- `env_rerun_count = output.envRerunCount`
- `prev_cipe_status = subagent_result.cipeStatus`
- `prev_sh_status = subagent_result.selfHealingStatus`
- `prev_verification_status = subagent_result.verificationStatus`
- `prev_failure_classification = subagent_result.failureClassification`
- `prev_status = output.action + ":" + (output.code || subagent_result.cipeStatus)`
- `poll_count++`

Based on `action`:

- **`action == "poll"`**: Print `output.message`, sleep `output.delay` seconds, go to 2a
  - If `output.newCipeDetected`: clear wait mode, reset `wait_mode = false`
- **`action == "wait"`**: Print `output.message`, sleep `output.delay` seconds, go to 2a
- **`action == "done"`**: Proceed to Step 3 with `output.code`

### Step 3: Handle Actionable Status

When decision script returns `action == "done"`:

1. Run cycle-check (Step 4) **before** handling the code
2. Check the returned `code`
3. Look up default behavior in the table above
4. Check if user instructions override the default
5. Execute the appropriate action
6. **If action expects new CI Attempt**, update tracking (see Step 3a)
7. If action results in looping, go to Step 2

#### Tool calls for actions

Several statuses require fetching additional data or calling tools:

- **fix_apply_ready**: Call `update_self_healing_fix` with action `APPLY`
- **fix_needs_local_verify**: Call `ci_information` with HEAVY_FIELDS for fix details before local verification
- **fix_needs_review**: Call `ci_information` with HEAVY_FIELDS → get `suggestedFixDescription`, `suggestedFixSummary`, `taskFailureSummaries`
- **fix_failed / no_fix**: Call `ci_information` with HEAVY_FIELDS → get `taskFailureSummaries` for local fix context
- **environment_issue**: Call `update_self_healing_fix` with action `RERUN_ENVIRONMENT_STATE`
- **self_healing_throttled**: Call `ci_information` with HEAVY_FIELDS → get `selfHealingSkipMessage`; then call `update_self_healing_fix` for each old fix

### Step 3a: Track State for New-CI-Attempt Detection

After actions that should trigger a new CI Attempt, run:

```bash
node <skill_dir>/scripts/ci-state-update.mjs post-action \
  --action <type> \
  --cipe-url <current_cipe_url> \
  --commit-sha <git_rev_parse_HEAD>
```

Action types: `fix-auto-applying`, `apply-mcp`, `apply-local-push`, `reject-fix-push`, `local-fix-push`, `env-rerun`, `auto-fix-push`, `empty-commit-push`

The script returns `{ waitMode, pollCount, lastCipeUrl, expectedCommitSha, agentTriggered }`. Update all tracking state from the output, then go to Step 2.

### Step 4: Cycle Classification and Progress Tracking

When the decision script returns `action == "done"`, run cycle-check **before** handling the code:

```bash
node <skill_dir>/scripts/ci-state-update.mjs cycle-check \
  --code <code> \
  [--agent-triggered] \
  --cycle-count <cycle_count> --max-cycles <max_cycles> \
  --env-rerun-count <env_rerun_count>
```

The script returns `{ cycleCount, agentTriggered, envRerunCount, approachingLimit, message }`. Update tracking state from the output.

- If `approachingLimit` → ask user whether to continue (with 5 or 10 more cycles) or stop monitoring
- If previous cycle was NOT agent-triggered (human pushed), log that human-initiated push was detected

#### Progress Tracking

- `no_progress_count`, circuit breaker (5 polls), and backoff reset are handled by ci-poll-decide.mjs (progress = any change in cipeStatus, selfHealingStatus, verificationStatus, or failureClassification)
- `env_rerun_count` reset on non-environment status is handled by ci-state-update.mjs cycle-check
- On new CI Attempt detected (poll script returns `newCipeDetected`) → reset `local_verify_count = 0`, `env_rerun_count = 0`

## Error Handling

| Error                          | Action                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Git rebase conflict            | Report to user, exit                                                                                        |
| `nx-cloud apply-locally` fails | Reject fix via MCP (`action: "REJECT"`), then attempt manual patch (Reject + Fix From Scratch Flow) or exit |
| MCP tool error                 | Retry once, if fails report to user                                                                         |
| Subagent spawn failure         | Retry once, if fails exit with error                                                                        |
| Decision script error          | Treat as `error` status, increment `no_progress_count`                                                      |
| No new CI Attempt detected     | If `--auto-fix-workflow`, try lockfile update; otherwise report to user with guidance                       |
| Lockfile auto-fix fails        | Report to user, exit with guidance to check CI logs                                                         |

## User Instruction Examples

Users can override default behaviors:

| Instruction                                      | Effect                                              |
| ------------------------------------------------ | --------------------------------------------------- |
| "never auto-apply"                               | Always prompt before applying any fix               |
| "always ask before git push"                     | Prompt before each push                             |
| "reject any fix for e2e tasks"                   | Auto-reject if `failedTaskIds` contains e2e         |
| "apply all fixes regardless of verification"     | Skip verification check, apply everything           |
| "if confidence < 70, reject"                     | Check confidence field before applying              |
| "run 'nx affected -t typecheck' before applying" | Add local verification step                         |
| "auto-fix workflow failures"                     | Attempt lockfile updates on pre-CI-Attempt failures |
| "wait 45 min for new CI Attempt"                 | Override new-CI-Attempt timeout (default: 10 min)   |
