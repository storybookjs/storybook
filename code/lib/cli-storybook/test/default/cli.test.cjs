import { expect, test } from 'vitest';

const { run, cleanLog } = require('../helpers.cjs');

test('suggests the closest match to an unknown command', () => {
  const { status, stdout } = run(['upgraed']);

  // Assertions
  expect(status).toBe(1);
  const stdoutString = cleanLog(stdout.toString());

  // Error messages are now written to stdout
  expect(stdoutString).toContain('Invalid command: upgraed.');
  expect(stdoutString).toContain('Did you mean upgrade?');
});

test('help command', () => {
  const { status, stdout, stderr } = run(['help']);

  const stderrString = cleanLog(stderr.toString());
  const stdoutString = cleanLog(stdout.toString());

  expect(stderrString).toBe('');
  expect(stdoutString).toContain('init');
  expect(stdoutString).toContain('Initialize Storybook into your project');

  expect(stdoutString).toContain('add');
  expect(stdoutString).toContain('Add an addon to your Storybook');

  expect(stdoutString).toContain('remove');
  expect(stdoutString).toContain('Remove an addon from your Storybook');

  expect(stdoutString).toContain('upgrade');
  expect(stdoutString).toContain('Upgrade your Storybook packages to');

  expect(stdoutString).toContain('migrate');
  expect(stdoutString).toContain('Run a Storybook codemod migration on your source files');

  expect(stdoutString).toContain('sandbox');
  expect(stdoutString).toContain('Create a sandbox from a set of possible templates');

  expect(stdoutString).toContain('link');
  expect(stdoutString).toContain(
    'Pull down a repro from a URL (or a local directory), link it, and run storybook'
  );

  expect(stdoutString).toContain('automigrate');
  expect(stdoutString).toContain(
    'Check storybook for incompatibilities or migrations and apply fixes'
  );

  expect(stdoutString).toContain('doctor');
  expect(stdoutString).toContain(
    'Check Storybook for known problems and provide suggestions or fixes'
  );

  expect(stdoutString).toContain('generate-stories');
  expect(stdoutString).toContain('Generate stories for components matching a glob pattern');

  expect(status).toBe(0);
});
