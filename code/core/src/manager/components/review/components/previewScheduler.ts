/**
 * Caps concurrent preview iframe boots across the review grid. See CollectionGrid
 * header comment for why this exists (`net::ERR_INSUFFICIENT_RESOURCES`).
 */
export const PREVIEW_SETTLE_TIMEOUT_MS = 1500;

const MAX_CONCURRENT_PREVIEWS = 3;

export interface PreviewTask {
  /** Assigns the iframe src, kicking off the actual load. */
  start: () => void;
  started: boolean;
  finished: boolean;
}

let activePreviewLoads = 0;
const previewQueue: PreviewTask[] = [];

function startQueuedPreviews(): void {
  while (activePreviewLoads < MAX_CONCURRENT_PREVIEWS) {
    const task = previewQueue.shift();
    if (!task) {
      return;
    }
    if (task.started || task.finished) {
      continue;
    }
    task.started = true;
    activePreviewLoads += 1;
    task.start();
  }
}

export function enqueuePreview(task: PreviewTask): void {
  previewQueue.push(task);
  startQueuedPreviews();
}

/** Mark a task done (load/error/settle/unmount) and let the next one start. */
export function finishPreview(task: PreviewTask): void {
  if (task.finished) {
    return;
  }
  task.finished = true;
  if (task.started) {
    activePreviewLoads = Math.max(0, activePreviewLoads - 1);
  } else {
    const index = previewQueue.indexOf(task);
    if (index !== -1) {
      previewQueue.splice(index, 1);
    }
  }
  startQueuedPreviews();
}

/** Hover/focus: start a still-queued preview right away, bypassing the cap. */
export function forceStartPreview(task: PreviewTask): void {
  if (task.started || task.finished) {
    return;
  }
  const index = previewQueue.indexOf(task);
  if (index !== -1) {
    previewQueue.splice(index, 1);
  }
  task.started = true;
  activePreviewLoads += 1;
  task.start();
}
