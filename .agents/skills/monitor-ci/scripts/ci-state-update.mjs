#!/usr/bin/env node

/**
 * CI State Update Script
 *
 * Deterministic state management for CI monitor actions.
 * Three commands: gate, post-action, cycle-check.
 *
 * Usage:
 *   node ci-state-update.mjs gate --gate-type <local-fix|env-rerun> [counter args]
 *   node ci-state-update.mjs post-action --action <type> [--cipe-url <url>] [--commit-sha <sha>]
 *   node ci-state-update.mjs cycle-check --code <code> [--agent-triggered] [counter args]
 */

// --- Arg parsing ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  return args.includes(name);
}

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

function output(result) {
  console.log(JSON.stringify(result));
}

// --- gate ---
// Check if an action is allowed and return incremented counter.
// Called before any local fix attempt or environment rerun.

function gate() {
  const gateType = getArg('--gate-type');

  if (gateType === 'local-fix') {
    const count = parseInt(getArg('--local-verify-count') || '0', 10);
    const max = parseInt(getArg('--local-verify-attempts') || '3', 10);
    if (count >= max) {
      return output({
        allowed: false,
        localVerifyCount: count,
        message: `Local fix budget exhausted (${count}/${max} attempts)`,
      });
    }
    return output({
      allowed: true,
      localVerifyCount: count + 1,
      message: null,
    });
  }

  if (gateType === 'env-rerun') {
    const count = parseInt(getArg('--env-rerun-count') || '0', 10);
    if (count >= 2) {
      return output({
        allowed: false,
        envRerunCount: count,
        message: `Environment issue persists after ${count} reruns. Manual investigation needed.`,
      });
    }
    return output({
      allowed: true,
      envRerunCount: count + 1,
      message: null,
    });
  }

  output({ allowed: false, message: `Unknown gate type: ${gateType}` });
}

// --- post-action ---
// Compute next state after an action is taken.
// Returns wait mode params and whether the action was agent-triggered.

function postAction() {
  const action = getArg('--action');
  const cipeUrl = getArg('--cipe-url');
  const commitSha = getArg('--commit-sha');

  // MCP-triggered or auto-applied: track by cipeUrl
  const cipeUrlActions = ['fix-auto-applying', 'apply-mcp', 'env-rerun'];
  // Local push: track by commitSha
  const commitShaActions = [
    'apply-local-push',
    'reject-fix-push',
    'local-fix-push',
    'auto-fix-push',
    'empty-commit-push',
  ];

  const trackByCipeUrl = cipeUrlActions.includes(action);
  const trackByCommitSha = commitShaActions.includes(action);

  if (!trackByCipeUrl && !trackByCommitSha) {
    return output({ error: `Unknown action: ${action}` });
  }

  // fix-auto-applying: self-healing did it, NOT the monitor
  const agentTriggered = action !== 'fix-auto-applying';

  output({
    waitMode: true,
    pollCount: 0,
    lastCipeUrl: trackByCipeUrl ? cipeUrl : null,
    expectedCommitSha: trackByCommitSha ? commitSha : null,
    agentTriggered,
  });
}

// --- cycle-check ---
// Cycle classification + counter resets when a new "done" code is received.
// Called at the start of handling each actionable code.

function cycleCheck() {
  const status = getArg('--code');
  const wasAgentTriggered = getFlag('--agent-triggered');
  let cycleCount = parseInt(getArg('--cycle-count') || '0', 10);
  const maxCycles = parseInt(getArg('--max-cycles') || '10', 10);
  let envRerunCount = parseInt(getArg('--env-rerun-count') || '0', 10);

  // Cycle classification: if previous cycle was agent-triggered, count it
  if (wasAgentTriggered) cycleCount++;

  // Reset env_rerun_count on non-environment status
  if (status !== 'environment_issue') envRerunCount = 0;

  // Approaching limit gate
  const approachingLimit = cycleCount >= maxCycles - 2;

  output({
    cycleCount,
    agentTriggered: false,
    envRerunCount,
    approachingLimit,
    message: approachingLimit ? `Approaching cycle limit (${cycleCount}/${maxCycles})` : null,
  });
}

// --- Dispatch ---

switch (command) {
  case 'gate':
    gate();
    break;
  case 'post-action':
    postAction();
    break;
  case 'cycle-check':
    cycleCheck();
    break;
  default:
    output({ error: `Unknown command: ${command}` });
}
