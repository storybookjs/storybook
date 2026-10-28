import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Locate the bundled mocker runtime script, for builders that bundle or serve it by path. */
export function getMockerRuntimePath(): string {
  return fileURLToPath(
    import.meta.resolve('@storybook/core/internal/mocking-utils/mocker-runtime')
  );
}

/**
 * Returns the bundled mocker runtime script content. This is used by builders (webpack5, vite,
 * etc.) to inject the mocker runtime into the preview iframe.
 */
export function getMockerRuntime(): string {
  return readFileSync(getMockerRuntimePath(), 'utf-8');
}
