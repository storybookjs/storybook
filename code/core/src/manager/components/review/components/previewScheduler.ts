// Caps concurrent preview iframe boots across the review grid: booting many
// embed iframes at once can fail with `net::ERR_INSUFFICIENT_RESOURCES`.
const MAX_CONCURRENT_PREVIEWS = 3;

/**
 * How long a started preview may hold its concurrency slot. The iframe's load/error events release
 * the slot earlier; this deadline keeps the queue draining when neither fires.
 */
export const PREVIEW_SETTLE_TIMEOUT_MS = 1500;

/** Handle for a scheduled preview boot, returned by `enqueuePreview`. */
export interface PreviewHandle {
  /** Hover/focus: start a still-queued preview right away, bypassing the cap. */
  forceStart: () => void;
  /** Release the concurrency slot (iframe loaded/errored/unmounted). Idempotent. */
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
 * slot is held until `release()` or the settle deadline, whichever comes first.
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
