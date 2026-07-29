import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

import { FinalizationCommand, executeFinalization } from './FinalizationCommand.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('empathic/find', { spy: true });

describe('FinalizationCommand', () => {
  let command: FinalizationCommand;

  beforeEach(() => {
    command = new FinalizationCommand({
      logfile: undefined,
      showAgentFollowUp: false,
      showAiInstructions: false,
      aiSetupCommand: 'npx storybook ai setup',
    });

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

  describe('agent mode', () => {
    it('should show agent-specific message when showAgentFollowUp=true', async () => {
      const agentCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: true,
        showAiInstructions: true,
        aiSetupCommand: 'pnpm exec storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await agentCommand.execute({});

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('is not entirely set up yet')
      );
      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('pnpm exec storybook ai setup')
      );
      const logCalls = vi.mocked(logger.log).mock.calls.map((c) => String(c[0]));
      expect(logCalls.some((msg) => msg.includes('https://storybook.js.org/llms.txt'))).toBe(true);
      expect(logCalls.some((msg) => msg.includes('https://discord.gg/storybook/'))).toBe(false);
    });

    it('should show standard success message when showAgentFollowUp=false with AI instructions', async () => {
      const agentCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: true,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await agentCommand.execute({});

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('Storybook was successfully installed')
      );
      // Ensure the agent message is NOT shown
      const stepCalls = vi.mocked(logger.step).mock.calls.map((c) => String(c[0]));
      expect(stepCalls.some((msg) => msg.includes('is not entirely set up yet'))).toBe(false);
    });

    it('should show standard success message when showAgentFollowUp=false', async () => {
      const nonAgentCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: false,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await nonAgentCommand.execute({});

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('Storybook was successfully installed')
      );
      // Ensure the agent message is NOT shown
      const stepCalls = vi.mocked(logger.step).mock.calls.map((c) => String(c[0]));
      expect(stepCalls.some((msg) => msg.includes('is not entirely set up yet'))).toBe(false);
      const logCalls = vi.mocked(logger.log).mock.calls.map((c) => String(c[0]));
      expect(logCalls.some((msg) => msg.includes('https://storybook.js.org/'))).toBe(true);
      expect(logCalls.some((msg) => msg.includes('https://discord.gg/storybook/'))).toBe(true);
      expect(logCalls.some((msg) => msg.includes('https://storybook.js.org/llms.txt'))).toBe(false);
    });
  });

  describe('AI instructions', () => {
    it('should show AI instructions when showAiInstructions=true', async () => {
      const aiCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: true,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await aiCommand.execute({});

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('To finalize setting up with AI')
      );
      expect(logger.step).toHaveBeenCalledWith(expect.stringContaining('npx storybook ai setup'));
    });

    it('should NOT show AI instructions when showAiInstructions=false', async () => {
      const noAiCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: false,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await noAiCommand.execute({});

      const stepCalls = vi.mocked(logger.step).mock.calls.map((c) => String(c[0]));
      expect(stepCalls.some((msg) => msg.includes('To finalize setting up with AI'))).toBe(false);
    });

    it('should show both agent message and AI instructions when both are true', async () => {
      const bothCommand = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: true,
        showAiInstructions: true,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await bothCommand.execute({});

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('is not entirely set up yet')
      );
      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('To finalize setting up with AI')
      );
    });
  });

  describe('storybookCommand message', () => {
    it('should print "To run Storybook, run" with the command', async () => {
      const cmd = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: false,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await cmd.execute({ storybookCommand: 'npm run storybook' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('To run Storybook, run'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('npm run storybook'));
    });

    it('should not print storybook command message when storybookCommand is null', async () => {
      const cmd = new FinalizationCommand({
        logfile: undefined,
        showAgentFollowUp: false,
        showAiInstructions: false,
        aiSetupCommand: 'npx storybook ai setup',
      });
      vi.mocked(find.up).mockReturnValue(undefined);

      await cmd.execute({ storybookCommand: null });

      const logCalls = vi.mocked(logger.log).mock.calls.map((c) => String(c[0]));
      expect(logCalls.some((msg) => msg.includes('To run Storybook, run'))).toBe(false);
    });
  });

  describe('executeFinalization helper', () => {
    it('should show agent follow-up when showAgentFollowUp=true', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      await executeFinalization({
        showAgentFollowUp: true,
        showAiInstructions: false,
        logfile: undefined,
        aiSetupCommand: 'npx storybook ai setup',
      });

      // Agent mode should show agent-specific message
      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('is not entirely set up yet')
      );
    });

    it('should pass showAiInstructions=true through to the command', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      await executeFinalization({
        showAgentFollowUp: false,
        showAiInstructions: true,
        logfile: undefined,
        aiSetupCommand: 'npx storybook ai setup',
      });

      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining('To finalize setting up with AI')
      );
    });

    it('should forward storybookCommand to execute', async () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      await executeFinalization({
        showAgentFollowUp: false,
        showAiInstructions: false,
        logfile: undefined,
        storybookCommand: 'yarn storybook',
        aiSetupCommand: 'npx storybook ai setup',
      });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('yarn storybook'));
    });
  });
});
