import { HandledError } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';

export const assertConfigMutationSuccess = (config: ConfigFile) => {
  if (config.mutationDiagnostics.length > 0) {
    throw new HandledError(config.mutationDiagnostics.map(({ message }) => message).join('\n'));
  }
};
