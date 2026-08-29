#!/usr/bin/env node

/**
 * CI Poll Decision Script
 *
 * Deterministic decision engine for CI monitoring.
 * Takes ci_information JSON + state args, outputs a single JSON action line.
 *
 * Architecture:
 *   classify()    — pure decision tree, returns { action, code, extra? }
 *   buildOutput() — maps classification to full output with messages, delays, counters
 *
 * Usage:
 *   node ci-poll-decide.mjs '<ci_info_json>' <poll_count> <verbosity> \
 *     [--wait-mode] [--prev-cipe-url <url>] [--expected-sha <sha>] \
 *     [--prev-status <status>] [--timeout <seconds>] [--new-cipe-timeout <seconds>] \
 *     [--env-rerun-count <n>] [--no-progress-count <n>] \
 *     [--prev-cipe-status <status>] [--prev-sh-status <status>] \
 *     [--prev-verification-status <status>] [--prev-failure-classification <status>]
 */

// --- Arg parsing ---

const args = process.argv.slice(2);
const ciInfoJson = args[0];
const pollCount = parseInt(args[1], 10) || 0;
const verbosity = args[2] || 'medium';

function getFlag(name) {
  return args.includes(name);
}

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const waitMode = getFlag('--wait-mode');
const prevCipeUrl = getArg('--prev-cipe-url');
const expectedSha = getArg('--expected-sha');
const prevStatus = getArg('--prev-status');
const timeoutSeconds = parseInt(getArg('--timeout') || '0', 10);
const newCipeTimeoutSeconds = parseInt(getArg('--new-cipe-timeout') || '0', 10);
const envRerunCount = parseInt(getArg('--env-rerun-count') || '0', 10);
const inputNoProgressCount = parseInt(getArg('--no-progress-count') || '0', 10);
const prevCipeStatus = getArg('--prev-cipe-status');
const prevShStatus = getArg('--prev-sh-status');
const prevVerificationStatus = getArg('--prev-verification-status');
const prevFailureClassification = getArg('--prev-failure-classification');

// --- Parse CI info ---

let ci;
try {
  ci = JSON.parse(ciInfoJson);
} catch {
  console.log(
    JSON.stringify({
      action: 'done',
      code: 'error',
      message: 'Failed to parse ci_information JSON',
      noProgressCount: inputNoProgressCount + 1,
      envRerunCount,
    })
  );
  process.exit(0);
}

const {
  cipeStatus,
  selfHealingStatus,
  verificationStatus,
  selfHealingEnabled,
  selfHealingSkippedReason,
  failureClassification: rawFailureClassification,
  failedTaskIds = [],
  verifiedTaskIds = [],
  couldAutoApplyTasks,
  autoApplySkipped,
  autoApplySkipReason,
  userAction,
  cipeUrl,
  commitSha,
} = ci;

const failureClassification = rawFailureClassification?.toLowerCase() ?? null;

// --- Helpers ---

function categorizeTasks() {
  const verifiedSet = new Set(verifiedTaskIds);
  const unverified = failedTaskIds.filter((t) => !verifiedSet.has(t));
  if (unverified.length === 0) return { category: 'all_verified' };

  const e2e = unverified.filter((t) => {
    const parts = t.split(':');
    return parts.length >= 2 && parts[1].includes('e2e');
  });
  if (e2e.length === unverified.length) return { category: 'e2e_only' };

  const verifiable = unverified.filter((t) => {
    const parts = t.split(':');
    return !(parts.length >= 2 && parts[1].includes('e2e'));
  });
  return { category: 'needs_local_verify', verifiableTaskIds: verifiable };
}

function backoff(count) {
  const delays = [60, 90, 120];
  return delays[Math.min(count, delays.length - 1)];
}

function hasStateChanged() {
  if (prevCipeStatus && cipeStatus !== prevCipeStatus) return true;
  if (prevShStatus && selfHealingStatus !== prevShStatus) return true;
  if (prevVerificationStatus && verificationStatus !== prevVerificationStatus)
    return true;
  if (
    prevFailureClassification &&
    failureClassification !== prevFailureClassification
  )
    return true;
  return false;
}

function isTimedOut() {
  if (timeoutSeconds <= 0) return false;
  const avgDelay = pollCount === 0 ? 0 : backoff(Math.floor(pollCount / 2));
  return pollCount * avgDelay >= timeoutSeconds;
}

function isWaitTimedOut() {
  if (newCipeTimeoutSeconds <= 0) return false;
  return pollCount * 30 >= newCipeTimeoutSeconds;
}

function isNewCipe() {
  return (
    (prevCipeUrl && cipeUrl && cipeUrl !== prevCipeUrl) ||
    (expectedSha && commitSha && commitSha === expectedSha)
  );
}

// ============================================================
// classify() — pure decision tree
//
// Returns: { action: 'poll'|'wait'|'done', code: string, extra? }
//
// Decision priority (top wins):
//   WAIT MODE:
//     1. new CI Attempt detected         → poll  (new_cipe_detected)
//     2. wait timed out                  → done  (no_new_cipe)
//     3. still waiting                   → wait  (waiting_for_cipe)
//   NORMAL MODE:
//     4. polling timeout                 → done  (polling_timeout)
//     5. circuit breaker (5 polls)       → done  (circuit_breaker)
//     6. CI succeeded                    → done  (ci_success)
//     7. CI canceled                     → done  (cipe_canceled)
//     8. CI timed out                    → done  (cipe_timed_out)
//     9. CI failed, no tasks recorded    → done  (cipe_no_tasks)
//    10. environment failure             → done  (environment_rerun_cap | environment_issue)
//    11. self-healing throttled          → done  (self_healing_throttled)
//    12. CI in progress / not started    → poll  (ci_running)
//    13. self-healing in progress        → poll  (sh_running)
//    14. flaky task auto-rerun           → poll  (flaky_rerun)
//    15. fix auto-applied                → poll  (fix_auto_applied)
//    16. auto-apply: skipped             → done  (fix_auto_apply_skipped)
//    17. auto-apply: verification pending→ poll  (verification_pending)
//    18. auto-apply: verified            → done  (fix_auto_applying)
//    19. fix: verification failed/none   → done  (fix_needs_review)
//    20. fix: all/e2e verified           → done  (fix_apply_ready)
//    21. fix: needs local verify         → done  (fix_needs_local_verify)
//    22. self-healing failed             → done  (fix_failed)
//    23. no fix available                → done  (no_fix)
//    24. fallback                        → poll  (fallback)
// ============================================================

function classify() {
  // --- Wait mode ---
  if (waitMode) {
    if (isNewCipe()) return { action: 'poll', code: 'new_cipe_detected' };
    if (isWaitTimedOut()) return { action: 'done', code: 'no_new_cipe' };
    return { action: 'wait', code: 'waiting_for_cipe' };
  }

  // --- Guards ---
  if (isTimedOut()) return { action: 'done', code: 'polling_timeout' };
  if (noProgressCount >= 5) return { action: 'done', code: 'circuit_breaker' };

  // --- Terminal CI states ---
  if (cipeStatus === 'SUCCEEDED') return { action: 'done', code: 'ci_success' };
  if (cipeStatus === 'CANCELED')
    return { action: 'done', code: 'cipe_canceled' };
  if (cipeStatus === 'TIMED_OUT')
    return { action: 'done', code: 'cipe_timed_out' };

  // --- CI failed, no tasks ---
  if (
    cipeStatus === 'FAILED' &&
    failedTaskIds.length === 0 &&
    selfHealingStatus == null
  )
    return { action: 'done', code: 'cipe_no_tasks' };

  // --- Environment failure ---
  if (failureClassification === 'environment_state') {
    if (envRerunCount >= 2)
      return { action: 'done', code: 'environment_rerun_cap' };
    return { action: 'done', code: 'environment_issue' };
  }

  // --- Throttled ---
  if (selfHealingSkippedReason === 'THROTTLED')
    return { action: 'done', code: 'self_healing_throttled' };

  // --- Still running: CI ---
  if (cipeStatus === 'IN_PROGRESS' || cipeStatus === 'NOT_STARTED')
    return { action: 'poll', code: 'ci_running' };

  // --- Still running: self-healing ---
  if (
    (selfHealingStatus === 'IN_PROGRESS' ||
      selfHealingStatus === 'NOT_STARTED') &&
    !selfHealingSkippedReason
  )
    return { action: 'poll', code: 'sh_running' };

  // --- Still running: flaky rerun ---
  if (failureClassification === 'flaky_task')
    return { action: 'poll', code: 'flaky_rerun' };

  // --- Fix auto-applied, waiting for new CI Attempt ---
  if (userAction === 'APPLIED_AUTOMATICALLY')
    return { action: 'poll', code: 'fix_auto_applied' };

  // --- Auto-apply path (couldAutoApplyTasks) ---
  if (couldAutoApplyTasks === true) {
    if (autoApplySkipped === true)
      return {
        action: 'done',
        code: 'fix_auto_apply_skipped',
        extra: { autoApplySkipReason },
      };
    if (
      verificationStatus === 'NOT_STARTED' ||
      verificationStatus === 'IN_PROGRESS'
    )
      return { action: 'poll', code: 'verification_pending' };
    if (verificationStatus === 'COMPLETED')
      return { action: 'done', code: 'fix_auto_applying' };
    // verification FAILED or NOT_EXECUTABLE → falls through to fix_needs_review
  }

  // --- Fix available ---
  if (selfHealingStatus === 'COMPLETED') {
    if (
      verificationStatus === 'FAILED' ||
      verificationStatus === 'NOT_EXECUTABLE' ||
      (couldAutoApplyTasks !== true && !verificationStatus)
    )
      return { action: 'done', code: 'fix_needs_review' };

    const tasks = categorizeTasks();
    if (tasks.category === 'all_verified' || tasks.category === 'e2e_only')
      return { action: 'done', code: 'fix_apply_ready' };
    return {
      action: 'done',
      code: 'fix_needs_local_verify',
      extra: { verifiableTaskIds: tasks.verifiableTaskIds },
    };
  }

  // --- Fix failed ---
  if (selfHealingStatus === 'FAILED')
    return { action: 'done', code: 'fix_failed' };

  // --- No fix available ---
  if (
    cipeStatus === 'FAILED' &&
    (selfHealingEnabled === false || selfHealingStatus === 'NOT_EXECUTABLE')
  )
    return { action: 'done', code: 'no_fix' };

  // --- Fallback ---
  return { action: 'poll', code: 'fallback' };
}

// ============================================================
// buildOutput() — maps classification to full JSON output
// ============================================================

// Message templates keyed by status or key
const messages = {
  // wait mode
  new_cipe_detected: () =>
    `New CI Attempt detected! CI: ${cipeStatus || 'N/A'}`,
  no_new_cipe: () =>
    'New CI Attempt timeout exceeded. No new CI Attempt detected.',
  waiting_for_cipe: () => 'Waiting for new CI Attempt...',

  // guards
  polling_timeout: () => 'Polling timeout exceeded.',
  circuit_breaker: () => 'No progress after 5 consecutive polls. Stopping.',

  // terminal
  ci_success: () => 'CI passed successfully!',
  cipe_canceled: () => 'CI Attempt was canceled.',
  cipe_timed_out: () => 'CI Attempt timed out.',
  cipe_no_tasks: () => 'CI failed but no Nx tasks were recorded.',

  // environment
  environment_rerun_cap: () => 'Environment rerun cap (2) exceeded. Bailing.',
  environment_issue: () => 'CI: FAILED | Classification: ENVIRONMENT_STATE',

  // throttled
  self_healing_throttled: () =>
    'Self-healing throttled \u2014 too many unapplied fixes.',

  // polling
  ci_running: () => `CI: ${cipeStatus}`,
  sh_running: () => `CI: ${cipeStatus} | Self-healing: ${selfHealingStatus}`,
  flaky_rerun: () =>
    'CI: FAILED | Classification: FLAKY_TASK (auto-rerun in progress)',
  fix_auto_applied: () =>
    'CI: FAILED | Fix auto-applied, new CI Attempt spawning',
  verification_pending: () =>
    `CI: FAILED | Self-healing: COMPLETED | Verification: ${verificationStatus}`,

  // actionable
  fix_auto_applying: () => 'Fix verified! Auto-applying...',
  fix_auto_apply_skipped: (extra) =>
    `Fix verified but auto-apply was skipped. ${
      extra?.autoApplySkipReason
        ? `Reason: ${extra.autoApplySkipReason}`
        : 'Offer to apply manually.'
    }`,
  fix_needs_review: () =>
    `Fix available but needs review. Verification: ${
      verificationStatus || 'N/A'
    }`,
  fix_apply_ready: () => 'Fix available and verified. Ready to apply.',
  fix_needs_local_verify: (extra) =>
    `Fix available. ${extra.verifiableTaskIds.length} task(s) need local verification.`,
  fix_failed: () => 'Self-healing failed to generate a fix.',
  no_fix: () => 'CI failed, no fix available.',

  // fallback
  fallback: () =>
    `CI: ${cipeStatus || 'N/A'} | Self-healing: ${
      selfHealingStatus || 'N/A'
    } | Verification: ${verificationStatus || 'N/A'}`,
};

// Codes where noProgressCount resets to 0 (genuine progress occurred)
const resetProgressCodes = new Set([
  'ci_success',
  'fix_auto_applying',
  'fix_auto_apply_skipped',
  'fix_needs_review',
  'fix_apply_ready',
  'fix_needs_local_verify',
]);

function formatMessage(msg) {
  if (verbosity === 'minimal') {
    const currentStatus = `${cipeStatus}|${selfHealingStatus}|${verificationStatus}`;
    if (currentStatus === (prevStatus || '')) return null;
    return msg;
  }
  if (verbosity === 'verbose') {
    return [
      `Poll #${pollCount + 1} | CI: ${cipeStatus || 'N/A'} | Self-healing: ${
        selfHealingStatus || 'N/A'
      } | Verification: ${verificationStatus || 'N/A'}`,
      msg,
    ].join('\n');
  }
  return `Poll #${pollCount + 1} | ${msg}`;
}

function buildOutput(decision) {
  const { action, code, extra } = decision;

  // noProgressCount is already computed before classify() was called.
  // Here we only handle the reset for "genuine progress" done-codes.

  const msgFn = messages[code];
  const rawMsg = msgFn ? msgFn(extra) : `Unknown: ${code}`;
  const message = formatMessage(rawMsg);

  const result = {
    action,
    code,
    message,
    noProgressCount: resetProgressCodes.has(code) ? 0 : noProgressCount,
    envRerunCount,
  };

  // Add delay
  if (action === 'wait') {
    result.delay = 30;
  } else if (action === 'poll') {
    result.delay = code === 'new_cipe_detected' ? 60 : backoff(noProgressCount);
    result.fields = 'light';
  }

  // Add extras
  if (code === 'new_cipe_detected') result.newCipeDetected = true;
  if (extra?.verifiableTaskIds)
    result.verifiableTaskIds = extra.verifiableTaskIds;
  if (extra?.autoApplySkipReason)
    result.autoApplySkipReason = extra.autoApplySkipReason;

  console.log(JSON.stringify(result));
}

// --- Run ---

// Compute noProgressCount from input. Single assignment, no mutation.
// Wait mode: reset on new cipe, otherwise unchanged (wait doesn't count as no-progress).
// Normal mode: reset on any state change, otherwise increment.
const noProgressCount = (() => {
  if (waitMode) return isNewCipe() ? 0 : inputNoProgressCount;
  if (isNewCipe() || hasStateChanged()) return 0;
  return inputNoProgressCount + 1;
})();

buildOutput(classify());
