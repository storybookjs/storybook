/**
 * Builder-agnostic change-detection adapter contract.
 *
 * The detector is owned by `code/core/src/core-server/change-detection/` and never imports a
 * builder package. Each builder ships its own `ChangeDetectionAdapter` implementation that
 * (a) supplies static resolve config once at start, and (b) pushes file-system events as
 * they occur.
 *
 * Builder-vite is the first consumer (see `code/builders/builder-vite/src/change-detection-adapter/`).
 */

import type { ModuleResolveConfig } from 'storybook/internal/types';

export type { ModuleResolveConfig };

export type FileChangeEvent =
  | { kind: 'add'; path: string }
  | { kind: 'change'; path: string }
  | { kind: 'unlink'; path: string };

export interface ChangeDetectionAdapter {
  /** Pull: builder produces resolve-config once at start; detector caches it. */
  getResolveConfig(): Promise<ModuleResolveConfig>;
  /** Push: builder reports file-system events; returns an unsubscribe function. */
  onFileChange(handler: (event: FileChangeEvent) => void): () => void;
  /** Optional: builder reports a startup failure so the detector can mark itself unavailable. */
  onStartupFailure?(handler: (event: { reason: string; error?: Error }) => void): () => void;
}
