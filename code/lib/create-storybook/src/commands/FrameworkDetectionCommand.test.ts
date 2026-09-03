import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { CreateReactAppUnsupportedError } from 'storybook/internal/server-errors';

import type { CommandOptions } from '../generators/types.ts';
import { FrameworkDetectionCommand } from './FrameworkDetectionCommand.ts';

vi.mock('../services/FrameworkDetectionService', { spy: true });
vi.mock('../services/TelemetryService', { spy: true });

const reactScriptsPackageJson = {
  dependencies: {
    react: '^18.0.0',
    'react-dom': '^18.0.0',
    'react-scripts': '5.0.1',
  },
};

describe('FrameworkDetectionCommand', () => {
  let command: FrameworkDetectionCommand;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    mockPackageManager = {
      primaryPackageJson: { packageJson: reactScriptsPackageJson },
    } as unknown as JsPackageManager;

    command = new FrameworkDetectionCommand(mockPackageManager);
  });

  it('fails fast for a react-scripts project instead of scaffolding', async () => {
    await expect(command.execute(ProjectType.REACT_SCRIPTS, {} as CommandOptions)).rejects.toThrow(
      CreateReactAppUnsupportedError
    );
  });

  it('stops init with the CRA removal message and migration anchor', async () => {
    const error: CreateReactAppUnsupportedError = await command
      .execute(ProjectType.REACT_SCRIPTS, {} as CommandOptions)
      .then(
        () => {
          throw new Error('Expected FrameworkDetectionCommand to throw for CRA projects');
        },
        (e) => e
      );

    expect(error).toBeInstanceOf(CreateReactAppUnsupportedError);
    expect(error.message).toContain('Create React App is not supported by Storybook 11+');
    expect(error.documentation).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-support-removed'
    );
  });
});
