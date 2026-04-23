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

export type FileChangeEvent =
  | { kind: 'add'; path: string }
  | { kind: 'change'; path: string }
  | { kind: 'unlink'; path: string };

export interface ResolveConfig {
  /** Project root (where Storybook is started from). */
  projectRoot: string;
  /** Resolved absolute path to the active tsconfig; oxc-resolver reads `paths`/`baseUrl` itself. */
  tsconfigPath?: string;
  /**
   * Builder-supplied alias map. Accepts both Vite shapes:
   *   - `Record<string, string>` (object form)
   *   - `Array<{ find: string | RegExp; replacement: string }>` (array form, supports regex)
   *
   * Regex aliases that cannot be translated to oxc-resolver are downgraded to opaque-leaf
   * with a debug log (R1 mitigation). Plain string aliases are forwarded as-is.
   */
  alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
  /**
   * Conditions for package `exports` resolution. Defaults to
   * `['storybook', 'import', 'module', 'default']`.
   */
  conditions?: string[];
}

export interface ChangeDetectionAdapter {
  /** Pull: builder produces resolve-config once at start; detector caches it. */
  getResolveConfig(): Promise<ResolveConfig>;
  /** Push: builder reports file-system events; returns an unsubscribe function. */
  onFileChange(handler: (event: FileChangeEvent) => void): () => void;
  /** Optional: builder reports a startup failure so the detector can mark itself unavailable. */
  onStartupFailure?(handler: (event: { reason: string; error?: Error }) => void): () => void;
}
