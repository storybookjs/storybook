import { fileURLToPath } from 'node:url';

/**
 * Returns the bundled mocker runtime script content. This is used by builders (webpack5, vite,
 * etc.) to inject the mocker runtime into the preview iframe.
 */
export function getMockerRuntime(): string {
  return fileURLToPath(import.meta.resolve('storybook/internal/mocking-utils/mocker-runtime'));
}
