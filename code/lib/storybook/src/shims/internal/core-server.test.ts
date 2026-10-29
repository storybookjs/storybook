import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as server from 'storybook/internal/server';

import * as coreServer from './core-server.ts';

vi.mock('storybook/internal/server', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  build: vi.fn(),
  buildDevStandalone: vi.fn(),
  exitOnDevServerSignal: vi.fn(),
}));

const OLD_ENTRY_NAMES = [
  'MDX_SERVICE_ID',
  'StoryIndexGenerator',
  'Tag',
  'analyzeMdx',
  'buildIndex',
  'buildIndexStandalone',
  'experimental_loadStorybook',
  'getComponentCandidates',
  'getRefsFromConfig',
  'getStoriesPathsFromConfig',
  'loadManifests',
  'mapStaticDir',
  'mdxManifestRef',
  'mdxQueryStaticPath',
  'mdxStaticStorePath',
  'runStoryTests',
  'ChangeDetectionFailureError',
  'ChangeDetectionService',
  'ChangeDetectionUnavailableError',
  'analyzeTestResults',
  'createDocsToolset',
  'createLocalDocsAccess',
  'createManifestDocsAccess',
  'createServiceDocsAccess',
  'createStoriesToolset',
  'createWorkerGatedStoryDocsProvider',
  'describeService',
  'emptyManifests',
  'experimental_MockUniversalStore',
  'experimental_defineService',
  'experimental_getChangeDetectionReadiness',
  'experimental_getStatusStore',
  'experimental_getTestProviderStore',
  'experimental_registerService',
  'experimental_resetChangeDetectionReadiness',
  'experimental_resetServicesPresetOnce',
  'experimental_setChangeDetectionHost',
  'findStoryIds',
  'getService',
  'internal_UniversalStore',
  'internal_fullStatusStore',
  'internal_fullTestProviderStore',
  'internal_universalStatusStore',
  'internal_universalTestProviderStore',
  'listServices',
  'registerToolset',
  'resolveChangeDetectionAdapter',
  'reviewToolset',
  'storyInputArraySchema',
  'toStoryTestResult',
  'build',
  'buildDevStandalone',
  'buildStaticStandalone',
  'getEffectiveToolAvailability',
  'getErrorLevel',
  'getManifestStatus',
  'getPreviewBodyTemplate',
  'getPreviewHeadTemplate',
  'getServerPort',
  'getToolAvailability',
  'isAddonA11yEnabled',
  'isAddonVitestEnabled',
  'isModuleGraphSupported',
  'isValidHost',
  'resolveOnboardingInitialPath',
  'resolveSkillInputs',
  'sendTelemetryError',
  'withTelemetry',
];

describe('storybook/internal/core-server compat entry', () => {
  it.each(OLD_ENTRY_NAMES.map((name) => ({ name, input: coreServer, expected: true })))(
    'exports $name',
    ({ name, input, expected }) => {
      expect(name in input && (input as Record<string, unknown>)[name] !== undefined).toBe(
        expected
      );
    }
  );
});

describe('storybook/internal/core-server dev compat', () => {
  const close = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    close.mockResolvedValue(undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'exits 0 after a passing smoke test',
      input: { smokeTest: true, exitCode: 0 },
      expected: { closeCalls: 1, processExitCalls: [[0]], signalListenersRegistered: 0 },
    },
    {
      name: 'exits 1 after a failing smoke test',
      input: { smokeTest: true, exitCode: 1 },
      expected: { closeCalls: 1, processExitCalls: [[1]], signalListenersRegistered: 0 },
    },
    {
      name: 'keeps a dev server running and exits on signals',
      input: { smokeTest: false, exitCode: undefined },
      expected: { closeCalls: 0, processExitCalls: [], signalListenersRegistered: 1 },
    },
  ])('buildDevStandalone $name', async ({ input, expected }) => {
    vi.mocked(server.buildDevStandalone).mockResolvedValue({
      port: 6006,
      address: '',
      networkAddress: '',
      storybook: {} as never,
      close,
      exitCode: input.exitCode,
    });

    await coreServer.buildDevStandalone({
      configDir: '.storybook',
      packageJson: {},
      smokeTest: input.smokeTest,
    });

    expect({
      closeCalls: close.mock.calls.length,
      processExitCalls: vi.mocked(process.exit).mock.calls,
      signalListenersRegistered: vi.mocked(server.exitOnDevServerSignal).mock.calls.length,
    }).toEqual(expected);
  });

  it.each([
    {
      name: 'exits after a dev smoke test',
      input: { options: { smokeTest: true }, frameworkOptions: {} },
      expected: { closeCalls: 1, processExitCalls: [[1]], signalListenersRegistered: 0 },
    },
    {
      name: 'exits after a dev smoke test requested by framework options',
      input: { options: { mode: 'dev' }, frameworkOptions: { smokeTest: true } },
      expected: { closeCalls: 1, processExitCalls: [[1]], signalListenersRegistered: 0 },
    },
    {
      name: 'keeps a dev server running and exits on signals',
      input: { options: { mode: 'dev' }, frameworkOptions: {} },
      expected: { closeCalls: 0, processExitCalls: [], signalListenersRegistered: 1 },
    },
    {
      name: 'leaves a static build alone',
      input: { options: { mode: 'static', smokeTest: true }, frameworkOptions: {} },
      expected: { closeCalls: 0, processExitCalls: [], signalListenersRegistered: 0 },
    },
  ])('build $name', async ({ input, expected }) => {
    vi.mocked(server.build).mockResolvedValue({
      port: 6006,
      address: '',
      networkAddress: '',
      storybook: {} as never,
      close,
      exitCode: 1,
    });

    await coreServer.build(input.options, input.frameworkOptions);

    expect({
      closeCalls: close.mock.calls.length,
      processExitCalls: vi.mocked(process.exit).mock.calls,
      signalListenersRegistered: vi.mocked(server.exitOnDevServerSignal).mock.calls.length,
    }).toEqual(expected);
  });
});
