// Serializes preview iframe boots across the review grid. Several same-origin embeds that boot at
// the same time race each other during the preview runtime's top-level initialization and some lose
// and never construct their preview runtime, leaving a blank thumbnail. Booting one at a time avoids
// the race entirely; a lone boot always succeeds. The slot is held until the consumer signals the
// preview actually booted (or the backstop deadline fires), NOT when the iframe document loads, so
// the next boot never overlaps one still coming up.
const MAX_CONCURRENT_PREVIEWS = 1;

/**
 * How long a started preview may hold its concurrency slot before it is released regardless. The
 * consumer releases earlier once the preview runtime boots; this backstop keeps the queue draining
 * if a preview never comes up. Generous enough to cover a cold boot.
 */
export const PREVIEW_SETTLE_TIMEOUT_MS = 10000;

/** Handle for a scheduled preview boot, returned by `enqueuePreview`. */
export interface PreviewHandle {
  /** Hover/focus: start a still-queued preview right away, bypassing the cap. */
  forceStart: () => void;
  /** Release the concurrency slot (preview booted, gave up, errored, or unmounted). Idempotent. */
  release: () => void;
}

interface Task {
  start: () => void;
  state: 'queued' | 'started' | 'released';
  deadline?: ReturnType<typeof setTimeout>;
}

let activePreviewLoads = 0;
const previewQueue: Task[] = [];

function startTask(task: Task): void {
  task.state = 'started';
  activePreviewLoads += 1;
  task.deadline = setTimeout(() => releaseTask(task), PREVIEW_SETTLE_TIMEOUT_MS);
  task.start();
}

function startQueuedPreviews(): void {
  while (activePreviewLoads < MAX_CONCURRENT_PREVIEWS && previewQueue.length > 0) {
    startTask(previewQueue.shift()!);
  }
}

function releaseTask(task: Task): void {
  if (task.state === 'released') {
    return;
  }
  if (task.state === 'started') {
    clearTimeout(task.deadline);
    activePreviewLoads -= 1;
  } else {
    previewQueue.splice(previewQueue.indexOf(task), 1);
  }
  task.state = 'released';
  startQueuedPreviews();
}

/**
 * Queue a preview boot. `start` runs (synchronously or later) once a concurrency slot frees up. The
 * slot is held until `release()` or the settle deadline, whichever comes first. Because only one
 * preview boots at a time, the consumer must call `release()` when the preview has booted so the
 * next queued preview can begin.
 */
export function enqueuePreview(start: () => void): PreviewHandle {
  const task: Task = { start, state: 'queued' };
  previewQueue.push(task);
  startQueuedPreviews();
  return {
    forceStart: () => {
      if (task.state !== 'queued') {
        return;
      }
      previewQueue.splice(previewQueue.indexOf(task), 1);
      startTask(task);
    },
    release: () => releaseTask(task),
  };
}
