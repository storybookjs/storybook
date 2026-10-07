import { resolve } from 'node:path';

import { SESSION_TIMEOUT } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCacheStore, mockCache } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return {
    mockCacheStore: store,
    mockCache: {
      get: async (key: string) => store.get(key),
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  };
});

vi.mock('storybook/internal/common', { spy: true });

describe('ai-checklist-flags', () => {
  beforeEach(async () => {
    mockCacheStore.clear();
    const common = await import('storybook/internal/common');
    vi.mocked(common.createFileSystemCache).mockReturnValue(mockCache as never);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('hasAiInitOptIn', () => {
    it('returns false when nothing is cached', async () => {
      const { hasAiInitOptIn } = await import('./ai-checklist-flags.ts');
      expect(await hasAiInitOptIn('/some/project/.storybook')).toBe(false);
    });

    it('returns false when the cached configDir is for a different project', async () => {
      mockCacheStore.set('ai-init-opt-in', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
      });
      const { hasAiInitOptIn } = await import('./ai-checklist-flags.ts');
      expect(await hasAiInitOptIn('/repo/packages/ui/.storybook')).toBe(false);
    });

    it('returns false when the cached entry lacks a configDir field', async () => {
      // Defensive — should never happen in practice because the CLI always
      // writes configDir, but a corrupted cache shouldn't unlock this flag.
      mockCacheStore.set('ai-init-opt-in', { timestamp: Date.now() });
      const { hasAiInitOptIn } = await import('./ai-checklist-flags.ts');
      expect(await hasAiInitOptIn('/any/project/.storybook')).toBe(false);
    });

    it('returns true when the cached configDir matches the resolved input', async () => {
      mockCacheStore.set('ai-init-opt-in', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
        answer: true,
      });
      const { hasAiInitOptIn } = await import('./ai-checklist-flags.ts');
      expect(await hasAiInitOptIn('/repo/apps/web/.storybook')).toBe(true);
    });

    it('returns false when the cached entry is for this project and indicates user opt-out', async () => {
      // Defensive — should never happen in practice because the CLI always
      // writes configDir, but a corrupted cache shouldn't unlock this flag.
      mockCacheStore.set('ai-init-opt-in', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
        answer: false,
      });
      const { hasAiInitOptIn } = await import('./ai-checklist-flags.ts');
      expect(await hasAiInitOptIn('/repo/apps/web/.storybook')).toBe(false);
    });
  });

  describe('hasAiSetupRun', () => {
    it('returns false when nothing is cached', async () => {
      const { hasAiSetupRun } = await import('./ai-checklist-flags.ts');
      expect(await hasAiSetupRun('/some/project/.storybook')).toBe(false);
    });

    it('returns true when the cached configDir matches', async () => {
      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
      });
      const { hasAiSetupRun } = await import('./ai-checklist-flags.ts');
      expect(await hasAiSetupRun('/repo/apps/web/.storybook')).toBe(true);
    });

    it('returns false when the cached configDir is for a sibling monorepo project', async () => {
      // Regression: running `storybook ai setup` in one repo must not flip
      // another repo's checklist to "done".
      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
      });
      const { hasAiSetupRun } = await import('./ai-checklist-flags.ts');
      expect(await hasAiSetupRun('/repo/packages/ui/.storybook')).toBe(false);
    });

    it('treats relative input as resolved against cwd', async () => {
      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now(),
        configDir: resolve('.storybook'),
      });
      const { hasAiSetupRun } = await import('./ai-checklist-flags.ts');
      expect(await hasAiSetupRun('.storybook')).toBe(true);
    });

    it('returns false when the cached entry lacks a configDir field', async () => {
      mockCacheStore.set('ai-setup-ran', { timestamp: Date.now() });
      const { hasAiSetupRun } = await import('./ai-checklist-flags.ts');
      expect(await hasAiSetupRun('/any/project/.storybook')).toBe(false);
    });
  });

  describe('isWithinAiSetupSession', () => {
    it('returns true only while the setup run is younger than the session timeout', async () => {
      const { isWithinAiSetupSession } = await import('./ai-checklist-flags.ts');
      const configDir = resolve('/repo/apps/web/.storybook');

      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now() - SESSION_TIMEOUT / 2,
        configDir,
      });
      expect(await isWithinAiSetupSession(configDir)).toBe(true);

      mockCacheStore.set('ai-setup-ran', { timestamp: Date.now() - SESSION_TIMEOUT, configDir });
      expect(await isWithinAiSetupSession(configDir)).toBe(false);
    });
  });

  describe('getAiSetupRunId', () => {
    it('returns undefined when nothing is cached', async () => {
      const { getAiSetupRunId } = await import('./ai-checklist-flags.ts');
      expect(await getAiSetupRunId('/some/project/.storybook')).toBeUndefined();
    });

    it('returns the runId when the cached configDir matches', async () => {
      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
        runId: 'abc123',
      });
      const { getAiSetupRunId } = await import('./ai-checklist-flags.ts');
      expect(await getAiSetupRunId('/repo/apps/web/.storybook')).toBe('abc123');
    });

    it('returns undefined when the cached configDir is for a different project', async () => {
      mockCacheStore.set('ai-setup-ran', {
        timestamp: Date.now(),
        configDir: resolve('/repo/apps/web/.storybook'),
        runId: 'abc123',
      });
      const { getAiSetupRunId } = await import('./ai-checklist-flags.ts');
      expect(await getAiSetupRunId('/repo/packages/ui/.storybook')).toBeUndefined();
    });
  });
});
