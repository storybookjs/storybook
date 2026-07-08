import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HandledError } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { updateMainConfig } from './automigrate/helpers/mainConfigFile.ts';
import {
  EXPERIMENTAL_FLAGS_REGISTRY,
  applyFlagsToProjects,
  parseFeatureNames,
  pendingFlagsForProject,
  projectNeedsFlagsHighlight,
  runExperimentalFlagsHighlightStep,
  selectProjectsNeedingFlagsHighlight,
  shouldSkipEntireStep,
  validateFeatureNames,
} from './experimentalFlags.ts';
import type { CollectProjectsSuccessResult } from './util.ts';

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/node-logger')>()),
    prompt: { multiselect: vi.fn() },
    logger: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

vi.mock('storybook/internal/telemetry');

vi.mock('./automigrate/helpers/mainConfigFile.ts', () => ({ updateMainConfig: vi.fn() }));

const createMockProject = (overrides: Partial<CollectProjectsSuccessResult> = {}) =>
  ({
    configDir: '/proj/.storybook',
    mainConfigPath: '/proj/.storybook/main.ts',
    mainConfig: {} as any,
    beforeVersion: '10.4.0',
    currentCLIVersion: '10.5.0',
    packageManager: {} as any,
    ...overrides,
  }) as CollectProjectsSuccessResult;

const [reviewFlag, docgenFlag] = EXPERIMENTAL_FLAGS_REGISTRY;

describe('experimentalFlags', () => {
  beforeEach(() => {
    // clearMocks resets call history but not implementations, so give multiselect a safe default
    // (an unresolved-value fallthrough would otherwise crash any test that unexpectedly reaches it).
    vi.mocked(prompt.multiselect).mockResolvedValue([]);
  });

  describe('projectNeedsFlagsHighlight', () => {
    it.each<[string, string, string, boolean]>([
      [
        'triggers when the upgrade crosses the 10.5 boundary within the same major',
        '10.4.0',
        '10.5.0',
        true,
      ],
      [
        'does not trigger when beforeVersion is already at or past the minimum version',
        '10.5.0',
        '10.6.0',
        false,
      ],
      [
        'does not trigger for cross-major upgrades (intentional per spec)',
        '9.6.0',
        '10.5.0',
        false,
      ],
      [
        'does not trigger when the upgrade never crosses the minimum version',
        '10.4.0',
        '10.4.5',
        false,
      ],
    ])('%s', (_description, beforeVersion, targetVersion, expected) => {
      expect(projectNeedsFlagsHighlight(beforeVersion, targetVersion)).toBe(expected);
    });

    it('returns false without throwing for a malformed version string', () => {
      expect(() => projectNeedsFlagsHighlight('not-a-version', '10.5.0')).not.toThrow();
      expect(projectNeedsFlagsHighlight('not-a-version', '10.5.0')).toBe(false);
    });
  });

  describe('selectProjectsNeedingFlagsHighlight', () => {
    it('returns only the projects whose upgrade crosses the minimum version boundary', () => {
      const eligible = createMockProject({
        configDir: '/eligible',
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
      });
      const alreadyPast = createMockProject({
        configDir: '/already-past',
        beforeVersion: '10.5.0',
        currentCLIVersion: '10.6.0',
      });
      const crossMajor = createMockProject({
        configDir: '/cross-major',
        beforeVersion: '9.6.0',
        currentCLIVersion: '10.5.0',
      });

      const result = selectProjectsNeedingFlagsHighlight([eligible, alreadyPast, crossMajor]);

      expect(result).toEqual([eligible]);
    });
  });

  describe('pendingFlagsForProject and shouldSkipEntireStep', () => {
    it('treats both flags as pending when no features are configured', () => {
      const project = createMockProject({ mainConfig: {} as any });

      expect(pendingFlagsForProject(project)).toEqual(EXPERIMENTAL_FLAGS_REGISTRY);
    });

    it('treats flags explicitly set to false as already set, so nothing is pending and the whole step is skipped', () => {
      const project = createMockProject({
        mainConfig: {
          features: { experimentalReview: false, experimentalDocgenServer: false },
        } as any,
      });

      expect(pendingFlagsForProject(project)).toEqual([]);
      expect(shouldSkipEntireStep([project])).toBe(true);
    });

    it('treats a flag explicitly set to true as already set (not pending)', () => {
      const project = createMockProject({
        mainConfig: { features: { experimentalReview: true } } as any,
      });

      expect(pendingFlagsForProject(project)).toEqual([docgenFlag]);
    });

    it('treats a project without a main config path as having nothing pending (it can never be written to)', () => {
      const project = createMockProject({ mainConfigPath: undefined, mainConfig: {} as any });

      expect(pendingFlagsForProject(project)).toEqual([]);
      expect(shouldSkipEntireStep([project])).toBe(true);
    });

    it('is false when at least one project among otherwise fully-set projects still has a pending flag', () => {
      const fullySet = createMockProject({
        configDir: '/fully-set',
        mainConfig: {
          features: { experimentalReview: true, experimentalDocgenServer: true },
        } as any,
      });
      const pending = createMockProject({
        configDir: '/pending',
        mainConfig: {} as any,
      });

      expect(shouldSkipEntireStep([fullySet, pending])).toBe(false);
    });
  });

  describe('parseFeatureNames', () => {
    it('returns an empty array for undefined', () => {
      expect(parseFeatureNames(undefined)).toEqual([]);
    });

    it('returns an empty array for an empty string', () => {
      expect(parseFeatureNames('')).toEqual([]);
    });

    it('splits on commas, trims whitespace, and drops empty entries', () => {
      expect(parseFeatureNames('a, b ,,c')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('validateFeatureNames', () => {
    it('does not throw when all names are valid', () => {
      expect(() =>
        validateFeatureNames(['experimentalReview', 'experimentalDocgenServer'])
      ).not.toThrow();
    });

    it('logs the error before throwing, since HandledError messages are not printed upstream', () => {
      expect(() => validateFeatureNames(['bogusFlag'])).toThrow(HandledError);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bogusFlag'));
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('experimentalReview, experimentalDocgenServer')
      );
    });

    it('throws naming the unknown flag and listing the valid ones', () => {
      expect(() => validateFeatureNames(['bogusFlag'])).toThrow(
        /Unknown experimental flag\(s\): bogusFlag/
      );
      expect(() => validateFeatureNames(['bogusFlag'])).toThrow(
        /Available flags: experimentalReview, experimentalDocgenServer/
      );
    });
  });

  describe('applyFlagsToProjects', () => {
    it('calls updateMainConfig once per project with a pending requested flag, and skips a project whose requested flags are already set', async () => {
      const pendingProject = createMockProject({
        configDir: '/pending',
        mainConfigPath: '/pending/.storybook/main.ts',
        mainConfig: {} as any,
      });
      const alreadySetProject = createMockProject({
        configDir: '/already-set',
        mainConfigPath: '/already-set/.storybook/main.ts',
        mainConfig: { features: { experimentalReview: true } } as any,
      });

      await applyFlagsToProjects([pendingProject, alreadySetProject], [reviewFlag], false);

      expect(updateMainConfig).toHaveBeenCalledTimes(1);
      expect(updateMainConfig).toHaveBeenCalledWith(
        { mainConfigPath: '/pending/.storybook/main.ts', dryRun: false },
        expect.any(Function)
      );
    });

    it('skips projects with mainConfigPath undefined', async () => {
      const project = createMockProject({ mainConfigPath: undefined, mainConfig: {} as any });

      await applyFlagsToProjects([project], [reviewFlag], false);

      expect(updateMainConfig).not.toHaveBeenCalled();
    });

    it('the callback passed to updateMainConfig only sets flags where getSafeFieldValue returns undefined', async () => {
      const project = createMockProject({ mainConfig: {} as any });

      await applyFlagsToProjects([project], [reviewFlag, docgenFlag], false);

      const callback = vi.mocked(updateMainConfig).mock.calls[0][1];
      const stubConfig = {
        getSafeFieldValue: vi.fn((path: string[]) =>
          path[1] === 'experimentalReview' ? true : undefined
        ),
        setFieldValue: vi.fn(),
      };

      await callback(stubConfig as any);

      expect(stubConfig.setFieldValue).toHaveBeenCalledTimes(1);
      expect(stubConfig.setFieldValue).toHaveBeenCalledWith(
        ['features', 'experimentalDocgenServer'],
        true
      );
    });

    it('forwards the dryRun argument verbatim to updateMainConfig', async () => {
      const dryRunProject = createMockProject({
        configDir: '/dry-run',
        mainConfigPath: '/dry-run/.storybook/main.ts',
      });
      const wetRunProject = createMockProject({
        configDir: '/wet-run',
        mainConfigPath: '/wet-run/.storybook/main.ts',
      });

      await applyFlagsToProjects([dryRunProject], [reviewFlag], true);
      await applyFlagsToProjects([wetRunProject], [reviewFlag], false);

      expect(updateMainConfig).toHaveBeenNthCalledWith(
        1,
        { mainConfigPath: '/dry-run/.storybook/main.ts', dryRun: true },
        expect.any(Function)
      );
      expect(updateMainConfig).toHaveBeenNthCalledWith(
        2,
        { mainConfigPath: '/wet-run/.storybook/main.ts', dryRun: false },
        expect.any(Function)
      );
    });

    it('syncs mainConfig.features in-memory when dryRun is false, and leaves it untouched when dryRun is true', async () => {
      const wetProject = createMockProject({ mainConfig: {} as any });
      await applyFlagsToProjects([wetProject], [reviewFlag, docgenFlag], false);
      expect(wetProject.mainConfig.features).toEqual({
        experimentalReview: true,
        experimentalDocgenServer: true,
      });

      const dryProject = createMockProject({ mainConfig: {} as any });
      await applyFlagsToProjects([dryProject], [reviewFlag, docgenFlag], true);
      expect(dryProject.mainConfig.features).toBeUndefined();
    });

    it('skips a flag whose required feature is explicitly disabled, warns, and still writes the others', async () => {
      const project = createMockProject({
        mainConfig: { features: { changeDetection: false } } as any,
      });

      await applyFlagsToProjects([project], [reviewFlag, docgenFlag], false);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('experimentalReview'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('changeDetection'));

      const callback = vi.mocked(updateMainConfig).mock.calls[0][1];
      const stubConfig = {
        getSafeFieldValue: vi.fn().mockReturnValue(undefined),
        setFieldValue: vi.fn(),
      };
      await callback(stubConfig as any);
      expect(stubConfig.setFieldValue).toHaveBeenCalledTimes(1);
      expect(stubConfig.setFieldValue).toHaveBeenCalledWith(
        ['features', 'experimentalDocgenServer'],
        true
      );
      expect(project.mainConfig.features).toEqual({
        changeDetection: false,
        experimentalDocgenServer: true,
      });
    });

    it('does not skip when the required feature is undefined or explicitly true', async () => {
      const undefinedDep = createMockProject({ mainConfig: {} as any });
      const trueDep = createMockProject({
        mainConfig: { features: { changeDetection: true } } as any,
      });

      await applyFlagsToProjects([undefinedDep, trueDep], [reviewFlag], false);

      expect(logger.warn).not.toHaveBeenCalled();
      expect(updateMainConfig).toHaveBeenCalledTimes(2);
    });

    it('skips the project entirely when every requested flag is blocked by a disabled dependency', async () => {
      const project = createMockProject({
        mainConfig: { features: { changeDetection: false } } as any,
      });

      await applyFlagsToProjects([project], [reviewFlag], false);

      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(project.mainConfig.features).toEqual({ changeDetection: false });
    });
  });

  describe('runExperimentalFlagsHighlightStep', () => {
    it('rejects with HandledError for an unknown --features name, without prompting, writing, or telemetry', async () => {
      const options = { features: 'bogusFlag', yes: false, dryRun: false };

      await expect(runExperimentalFlagsHighlightStep([], options)).rejects.toThrow(HandledError);

      expect(prompt.multiselect).not.toHaveBeenCalled();
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('applies an explicitly requested flag even when no project is version-eligible, and sends features-flag telemetry', async () => {
      const project = createMockProject({
        beforeVersion: '10.5.0',
        currentCLIVersion: '10.6.0',
        mainConfig: {} as any,
      });
      const options = { features: 'experimentalReview', yes: false, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(updateMainConfig).toHaveBeenCalledTimes(1);
      expect(updateMainConfig).toHaveBeenCalledWith(
        { mainConfigPath: project.mainConfigPath, dryRun: false },
        expect.any(Function)
      );
      expect(telemetry).toHaveBeenCalledWith('upgrade-experimental-flags', {
        flags: ['experimentalReview'],
        source: 'features-flag',
      });
    });

    it('deduplicates repeated --features names in the telemetry payload', async () => {
      const project = createMockProject({ mainConfig: {} as any });
      const options = {
        features: 'experimentalReview,experimentalReview',
        yes: false,
        dryRun: false,
      };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(telemetry).toHaveBeenCalledWith('upgrade-experimental-flags', {
        flags: ['experimentalReview'],
        source: 'features-flag',
      });
    });

    it('does nothing when there are no eligible projects and no explicit features', async () => {
      const project = createMockProject({ beforeVersion: '10.5.0', currentCLIVersion: '10.6.0' });
      const options = { features: undefined, yes: false, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(prompt.multiselect).not.toHaveBeenCalled();
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('does nothing when every eligible project already has every flag set (shouldSkipEntireStep short-circuit)', async () => {
      const project = createMockProject({
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
        mainConfig: {
          features: { experimentalReview: true, experimentalDocgenServer: true },
        } as any,
      });
      const options = { features: undefined, yes: false, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(prompt.multiselect).not.toHaveBeenCalled();
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('does nothing when --yes is set, even with eligible pending projects', async () => {
      const project = createMockProject({
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
        mainConfig: {} as any,
      });
      const options = { features: undefined, yes: true, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(prompt.multiselect).not.toHaveBeenCalled();
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('applies the interactively selected flag and sends prompt-source telemetry', async () => {
      vi.mocked(prompt.multiselect).mockResolvedValue(['experimentalReview']);
      const project = createMockProject({
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
        mainConfig: {} as any,
      });
      const options = { features: undefined, yes: false, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(prompt.multiselect).toHaveBeenCalledTimes(1);
      expect(updateMainConfig).toHaveBeenCalledTimes(1);

      const callback = vi.mocked(updateMainConfig).mock.calls[0][1];
      const stubConfig = {
        getSafeFieldValue: vi.fn().mockReturnValue(undefined),
        setFieldValue: vi.fn(),
      };
      await callback(stubConfig as any);
      expect(stubConfig.setFieldValue).toHaveBeenCalledTimes(1);
      expect(stubConfig.setFieldValue).toHaveBeenCalledWith(
        ['features', 'experimentalReview'],
        true
      );

      expect(telemetry).toHaveBeenCalledWith('upgrade-experimental-flags', {
        flags: ['experimentalReview'],
        source: 'prompt',
      });
    });

    it('does nothing when the interactive prompt resolves to no selection', async () => {
      vi.mocked(prompt.multiselect).mockResolvedValue([]);
      const project = createMockProject({
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
        mainConfig: {} as any,
      });
      const options = { features: undefined, yes: false, dryRun: false };

      await runExperimentalFlagsHighlightStep([project], options);

      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('logs a dry-run notice with the flag name and skips writes/telemetry for --features with --dry-run', async () => {
      const options = { features: 'experimentalReview', yes: false, dryRun: true };

      await runExperimentalFlagsHighlightStep([], options);

      const [message] = vi.mocked(logger.log).mock.calls[0];
      expect(message).toMatch(/dry run/i);
      expect(message).toMatch(/experimentalReview/);
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('logs pending flag names with a dry-run notice, without prompting or writing', async () => {
      const project = createMockProject({
        beforeVersion: '10.4.0',
        currentCLIVersion: '10.5.0',
        mainConfig: {} as any,
      });
      const options = { features: undefined, yes: false, dryRun: true };

      await runExperimentalFlagsHighlightStep([project], options);

      const [message] = vi.mocked(logger.log).mock.calls[0];
      expect(message).toMatch(/dry run/i);
      expect(message).toMatch(/experimentalReview/);
      expect(message).toMatch(/experimentalDocgenServer/);
      expect(prompt.multiselect).not.toHaveBeenCalled();
      expect(updateMainConfig).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });
  });
});
