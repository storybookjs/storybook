import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    command = new FinalizationCommand(undefined);

    vi.mocked(getProjectRoot).mockReturnValue('/test/project');
    vi.mocked(logger.step).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.outro).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should update gitignore and print success message', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue('node_modules/\n');
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await command.execute({
        storybookCommand: 'npm run storybook',
      });

      expect(fs.appendFile).toHaveBeenCalledWith(
        '/test/project/.gitignore',
        '\n*storybook.log\nstorybook-static\n'
      );
      expect(logger.step).toHaveBeenCalledWith(expect.stringContaining('successfully installed'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('npm run storybook'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('storybook.js.org'));
    });

    it('should not update gitignore if file not found', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      await command.execute({
        storybookCommand: 'yarn storybook',
      });

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
      expect(logger.step).toHaveBeenCalled();
    });

    it('should not update gitignore if file is outside project root', async () => {
      vi.mocked(find.up).mockReturnValue('/other/path/.gitignore');
      vi.mocked(getProjectRoot).mockReturnValue('/test/project');

      await command.execute({
        storybookCommand: 'npm run storybook',
      });

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should not add entries that already exist in gitignore', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue('node_modules/\n*storybook.log\nstorybook-static\n');

      await command.execute({
        storybookCommand: 'npm run storybook',
      });

      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should add only missing entries to gitignore', async () => {
      vi.mocked(find.up).mockReturnValue('/test/project/.gitignore');
      vi.mocked(fs.readFile).mockResolvedValue('node_modules/\n*storybook.log\n');
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await command.execute({
        storybookCommand: 'npm run storybook',
      });

      expect(fs.appendFile).toHaveBeenCalledWith(
        '/test/project/.gitignore',
        '\nstorybook-static\n'
      );
    });

    it('should include storybook command in output', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      await command.execute({
        storybookCommand: 'ng run my-app:storybook',
      });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ng run my-app:storybook'));
    });
  });
});
