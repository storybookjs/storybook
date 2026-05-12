/**
 * Talks to a running Storybook UI on http://localhost:6006.
 *
 * Reads the change-detection status snapshot via the `/_status_/change-detection`
 * middleware that `@storybook/addon-before-after` registers in its preset.
 * That endpoint is provided by the patch in
 * `project-documents/questions/appendix/patches/{03,04}-*` (apply on the
 * `valentin/before-after` branch before booting).
 *
 * If the endpoint isn't available, falls back to a JSON file at
 * `/tmp/sb-cd-statuses.json` populated via the DevTools probe snippet
 * (printed by the harness).
 */
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const STORYBOOK_URL = process.env.STORYBOOK_URL || 'http://localhost:6006';
const PROBE_FALLBACK_FILE = '/tmp/sb-cd-statuses.json';
const POLL_INTERVAL_MS = 500;
// Generous budget: change-detection runs through OXC parser pool + git diff
// + reverse-index scan. On a 504-story monorepo this can take 30-60s on
// first cold trigger after a long-idle period; on this 1.2K-story monorepo
// it has been observed to take >90s for cascade-triggering edits.
const POLL_MAX_MS = 180_000;

export interface StoryIndexEntry {
  id: string;
  title: string;
  name: string;
  importPath: string;
  type: 'story' | 'docs';
  tags?: string[];
}

export interface StoryIndex {
  entries: Record<string, StoryIndexEntry>;
}

export interface CdStatus {
  storyId: string;
  value:
    | 'status-value:new'
    | 'status-value:modified'
    | 'status-value:affected';
}

export async function assertStorybookRunning(): Promise<StoryIndex> {
  const r = await fetch(`${STORYBOOK_URL}/index.json`).catch((e) => {
    throw new Error(
      `Storybook not reachable at ${STORYBOOK_URL}: ${e?.message ?? e}`
    );
  });
  if (!r.ok) throw new Error(`Storybook /index.json returned ${r.status}`);
  return (await r.json()) as StoryIndex;
}

/**
 * Polls until change-detection statuses stabilise.
 *
 * Two stability conditions:
 *  - Non-empty stable: two consecutive samples with the same length > 0
 *  - Empty stable: 60 consecutive empty samples (30 seconds of nothing) —
 *    the dogfood's change-detection scan can take 30+ seconds to fire after
 *    a file watcher event, so we have to be patient before declaring "true
 *    zero cascade." 30 seconds is calibrated against the live behaviour of
 *    `valentin/before-after` on the 1.2K-story dogfood.
 */
export async function pollChangeDetection(opts?: { expectEmpty?: boolean }): Promise<CdStatus[]> {
  // Initial grace period — let the file watcher fire and change-detection
  // run its scan before we start polling.
  await delay(2000);

  const start = Date.now();
  let lastCount = -1;
  let nonEmptyStable = 0;
  let emptyStable = 0;
  // For zero-cascade scenarios (css-only, regex-aliased) we can short-circuit
  // earlier because we know the change-detection backend won't emit anything.
  // Default uses a longer empty-stable threshold to defend against
  // change-detection's slow first-scan after a long-idle period.
  const emptyStableThreshold = opts?.expectEmpty ? 10 : 60;
  while (Date.now() - start < POLL_MAX_MS) {
    const statuses = await fetchStatusesViaProbe();
    if (statuses === null) {
      const fromFile = await readFromFallback();
      if (fromFile && fromFile.length > 0) return fromFile;
    } else if (statuses.length > 0 && statuses.length === lastCount) {
      nonEmptyStable++;
      emptyStable = 0;
      if (nonEmptyStable >= 2) return statuses;
    } else if (statuses && statuses.length === 0) {
      emptyStable++;
      nonEmptyStable = 0;
      lastCount = 0;
      if (emptyStable >= emptyStableThreshold) return [];
    } else if (statuses) {
      nonEmptyStable = 0;
      emptyStable = 0;
      lastCount = statuses.length;
    }
    await delay(POLL_INTERVAL_MS);
  }
  return [];
}

/**
 * Wait until the probe endpoint reports an empty status set — used between
 * scenarios so the next scenario's `applyEdit` lands on a clean baseline.
 */
export async function waitForEmptyBaseline(maxMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const statuses = await fetchStatusesViaProbe();
    if (statuses && statuses.length === 0) return;
    await delay(POLL_INTERVAL_MS);
  }
}

async function fetchStatusesViaProbe(): Promise<CdStatus[] | null> {
  try {
    const r = await fetch(`${STORYBOOK_URL}/_status_/change-detection`);
    if (!r.ok) return null;
    return (await r.json()) as CdStatus[];
  } catch {
    return null;
  }
}

async function readFromFallback(): Promise<CdStatus[] | null> {
  try {
    const text = await readFile(PROBE_FALLBACK_FILE, 'utf8');
    return JSON.parse(text) as CdStatus[];
  } catch {
    return null;
  }
}

export const DEVTOOLS_PROBE_SNIPPET = `// Paste in the Storybook manager DevTools console:
(() => {
  const all = window.__STORYBOOK_API__.internal_fullStatusStore.getAll();
  const out = [];
  for (const [storyId, byTypeId] of Object.entries(all)) {
    const cd = byTypeId['storybook/change-detection'];
    if (cd) out.push({ storyId, value: cd.value });
  }
  copy(JSON.stringify(out));
  console.log('Copied', out.length, 'statuses to clipboard. Save to ${PROBE_FALLBACK_FILE}');
})();`;
