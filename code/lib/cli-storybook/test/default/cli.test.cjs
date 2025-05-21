import { describe, expect, it } from 'vitest';

const run = require('../helpers.cjs');

describe('Default behavior', () => {
  it('suggests the closest match to an unknown command', () => {
    const { status, stderr, stdout } = run(['upgraed']);

    // Assertions
    expect(status).toBe(1);
    expect(stderr.toString()).toContain('Invalid command: upgraed.');
    expect(stdout.toString()).toContain('Did you mean upgrade?');
  });
});

describe('Help command', () => {
  it('should prints out "init" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('init');
    expect(stdout.toString()).toContain('Initialize Storybook into your project');
    expect(status).toBe(0);
  });

  it('should prints out "add" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('add');
    expect(stdout.toString()).toContain('Add an addon to your Storybook');
    expect(status).toBe(0);
  });

  it('should prints out "remove" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('remove');
    expect(stdout.toString()).toContain('Remove an addon from your Storybook');
    expect(status).toBe(0);
  });

  it('should prints out "upgrade" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('upgrade');
    expect(stdout.toString()).toContain('Upgrade your Storybook packages to');
    expect(status).toBe(0);
  });

  it('should prints out "migrate" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('migrate');
    expect(stdout.toString()).toContain('Run a Storybook codemod migration on your source files');
    expect(status).toBe(0);
  });

  it('should prints out "sandbox" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('sandbox');
    expect(stdout.toString()).toContain('Create a sandbox from a set of possible templates');
    expect(status).toBe(0);
  });

  it('should prints out "link" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('link');
    expect(stdout.toString()).toContain(
      'Pull down a repro from a URL (or a local directory), link it, and run storybook'
    );
    expect(status).toBe(0);
  });

  it('should prints out "automigrate" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('automigrate');
    expect(stdout.toString()).toContain(
      'Check storybook for incompatibilities or migrations and apply fixes'
    );
    expect(status).toBe(0);
  });

  it('should prints out "doctor" command', () => {
    const { status, stdout, stderr } = run(['help']);

    expect(stderr.toString()).toBe('');
    expect(stdout.toString()).toContain('doctor');
    expect(stdout.toString()).toContain(
      'Check Storybook for known problems and provide suggestions or fixes'
    );
    expect(status).toBe(0);
  });
});
