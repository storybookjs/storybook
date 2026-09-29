/**
 * NOTE: These tests use the VersionService from the refactored implementation. The promptNewUser
 * and promptInstallType functions are tested in:
 *
 * - Services/VersionService.test.ts (for version detection)
 * - Commands/UserPreferencesCommand.test.ts (for user prompts)
 */
import { describe, expect, it, vi } from 'vitest';

import { VersionService } from './services/VersionService.ts';

// Create a version service instance for testing
const versionService = new VersionService();
const getCliIntegrationFromAncestry =
  versionService.getCliIntegrationFromAncestry.bind(versionService);

vi.mock('storybook/internal/telemetry');

vi.mock('storybook/internal/core-server', () => ({
  getServerPort: vi.fn().mockResolvedValue(6006),
  withTelemetry: vi.fn(),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logTracker: {
    writeToFile: vi.fn().mockResolvedValue('/tmp/debug-storybook.log'),
  },
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    outro: vi.fn(),
  },
}));

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
