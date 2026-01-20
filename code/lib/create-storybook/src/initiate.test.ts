/**
 * NOTE: These tests use the VersionService from the refactored implementation. The promptNewUser
 * and promptInstallType functions are tested in:
 *
 * - Services/VersionService.test.ts (for version detection)
 * - Commands/UserPreferencesCommand.test.ts (for user prompts)
 */
import { describe, expect, it, vi } from 'vitest';

import { VersionService } from './services/VersionService';

// Create a version service instance for testing
const versionService = new VersionService();
const getStorybookVersionFromAncestry =
  versionService.getStorybookVersionFromAncestry.bind(versionService);
const getCliIntegrationFromAncestry =
  versionService.getCliIntegrationFromAncestry.bind(versionService);

vi.mock('storybook/internal/telemetry');

vi.mock('storybook/internal/core-server', () => ({
  getServerPort: vi.fn().mockResolvedValue(6006),
}));

describe('getStorybookVersionFromAncestry', () => {
  it('possible storybook path', () => {
    const ancestry = [{ command: 'node' }, { command: 'storybook@7.0.0' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('create storybook', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npm create storybook@7.0.0-alpha.3' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('7.0.0-alpha.3');
  });

  it('storybook init', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx storybook@7.0.0 init' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('7.0.0');
  });

  it('storybook init no version', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx storybook init' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('create-storybook with latest', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx create-storybook@latest' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('latest');
  });

  it('foo-storybook with latest', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx foo-storybook@latest' },
      { command: 'npm' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });

  it('multiple matches', () => {
    const ancestry = [
      { command: 'node' },
      { command: 'npx create-storybook@foo' },
      { command: 'npm' },
      { command: 'npx create-storybook@bar' },
    ];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBe('bar');
  });

  it('returns undefined if no storybook version found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npm' }];
    expect(getStorybookVersionFromAncestry(ancestry as any)).toBeUndefined();
  });
});

describe('getCliIntegrationFromAncestry', () => {
  it('returns the CLI integration if nested calls', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }, { command: 'npx sv create' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv create');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns the CLI integration if found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npx sv@latest add' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBe('sv add');
  });

  it('returns undefined if no CLI integration found', () => {
    const ancestry = [{ command: 'node' }, { command: 'npm' }];
    expect(getCliIntegrationFromAncestry(ancestry as any)).toBeUndefined();
  });
});
