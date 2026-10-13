import { StorybookError } from 'storybook/internal/server-errors';

export class SandboxBaselineError extends StorybookError {
  constructor(message: string) {
    super({ category: 'DOCGEN_HARNESS', code: 1, name: 'SandboxBaselineError', message });
  }
}
