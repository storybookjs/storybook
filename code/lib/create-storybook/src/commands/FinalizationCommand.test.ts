import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

import { FinalizationCommand } from './FinalizationCommand';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('empathic/find', { spy: true });

describe('FinalizationCommand', () => {
  let command: FinalizationCommand;

  beforeEach(() => {
    command = new FinalizationCommand();

    vi.mocked(getProjectRoot).mockReturnValue('/test/project');
    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.outro).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should update gitignore and print success message', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue('node_modules/\n' as any);
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      const selectedFeatures = new Set(['docs', 'test'] as const);

      await command.execute(ProjectType.REACT, selectedFeatures, 'npm run storybook');

      expect(fs.appendFile).toHaveBeenCalledWith(
        '/test/project/.gitignore',
        '\n*storybook.log\nstorybook-static\n'
      );
      expect(logger.step).toHaveBeenCalledWith(expect.stringContaining('successfully installed'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('docs, test'));
    });

    it('should not update gitignore if file not found', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.VUE3, selectedFeatures, 'yarn storybook');

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
      expect(logger.step).toHaveBeenCalled();
    });

    it('should not update gitignore if file is outside project root', async () => {
      vi.mocked(find.up).mockReturnValue('/other/path/.gitignore');
      vi.mocked(getProjectRoot).mockReturnValue('/test/project');

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.REACT, selectedFeatures, 'npm run storybook');

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should not add entries that already exist in gitignore', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue(
        'node_modules/\n*storybook.log\nstorybook-static\n' as any
      );

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.REACT, selectedFeatures, 'npm run storybook');

      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should add only missing entries to gitignore', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue('node_modules/\n*storybook.log\n' as any);
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.REACT, selectedFeatures, 'npm run storybook');

      expect(fs.appendFile).toHaveBeenCalledWith(
        '/test/project/.gitignore',
        '\nstorybook-static\n'
      );
    });

    it('should print features as "none" when no features selected', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.REACT, selectedFeatures, 'npm run storybook');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Additional features: none'));
    });

    it('should print all selected features', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      const selectedFeatures = new Set(['docs', 'test', 'onboarding'] as const);

      await command.execute(ProjectType.NEXTJS, selectedFeatures, 'npm run storybook');

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Additional features: docs, test, onboarding')
      );
    });

    it('should include storybook command in output', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      const selectedFeatures = new Set([]);

      await command.execute(ProjectType.ANGULAR, selectedFeatures, 'ng run my-app:storybook');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ng run my-app:storybook'));
    });
  });
});
