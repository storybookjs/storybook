import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  prebuild: async (cwd) => {
    await exec('jiti', [path.join(import.meta.dirname, 'scripts', 'generate-source-files.ts')], {
      nodeOptions: {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          FORCE_COLOR: '1',
        },
        stdio: 'inherit',
      },
      throwOnError: true,
    });
  },
  deepExportsPattern: true,
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/instance/public.ts',
      },
      {
        exportEntries: ['./internal/instance'],
        entryPoint: './src/instance/index.ts',
      },
      {
        exportEntries: ['./internal/preview-page'],
        entryPoint: './src/preview-page/index.ts',
      },
      {
        exportEntries: ['./internal/node-logger'],
        entryPoint: './src/node-logger/index.ts',
      },
      {
        exportEntries: ['./internal/server-errors'],
        entryPoint: './src/server-errors.ts',
      },
      {
        exportEntries: ['./internal/story-index'],
        entryPoint: './src/story-index/index.ts',
      },
      {
        exportEntries: ['./internal/services'],
        entryPoint: './src/services/index.ts',
      },
      {
        exportEntries: ['./internal/oxc-parser'],
        entryPoint: './src/oxc-parser/index.ts',
      },
      {
        entryPoint: './src/oxc-parser/worker.ts',
        dts: false,
      },
      {
        // Long-lived worker that runs docgen extraction off the main thread. Exposed as an internal
        // export so docgen-worker-client.ts resolves it via the package map (import.meta.resolve)
        // rather than a hard-coded dist path, keeping strict package managers (pnpm) happy.
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/shared/open-service/services/docgen/worker/docgen-worker.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/telemetry'],
        entryPoint: './src/telemetry/index.ts',
      },
      {
        exportEntries: ['./internal/csf-tools'],
        entryPoint: './src/csf-tools/index.ts',
      },
      {
        exportEntries: ['./internal/bin/loader'],
        entryPoint: './src/bin/loader.ts',
        outputPath: 'storybook/bin/loader',
        dts: false,
      },
      {
        exportEntries: ['./internal/common'],
        entryPoint: './src/common/index.ts',
      },
      {
        exportEntries: ['./internal/component-meta'],
        entryPoint: './src/component-meta/index.ts',
      },
      {
        exportEntries: ['./internal/mocking-utils'],
        entryPoint: './src/test/mocking/index.ts',
      },
      // Deep entries: files the higher packages import directly. A key listed for both platforms
      // gets a `node` condition, so each platform shares the copy core's own entries use.
      {
        exportEntries: ['./internal/deep/common/globalSettings'],
        entryPoint: './src/common/globalSettings.ts',
      },
      {
        exportEntries: ['./internal/deep/common/utils/constants'],
        entryPoint: './src/common/utils/constants.ts',
      },
      {
        exportEntries: ['./internal/deep/common/utils/server-statics'],
        entryPoint: './src/common/utils/server-statics.ts',
      },
      {
        exportEntries: ['./internal/deep/common/versions'],
        entryPoint: './src/common/versions.ts',
      },
      {
        exportEntries: ['./internal/deep/csf-tools/estree/ast'],
        entryPoint: './src/csf-tools/estree/ast.ts',
      },
      {
        exportEntries: ['./internal/deep/csf-tools/estree/editor'],
        entryPoint: './src/csf-tools/estree/editor.ts',
      },
      {
        exportEntries: ['./internal/deep/instance/instance-context'],
        entryPoint: './src/instance/instance-context.ts',
      },
      {
        exportEntries: ['./internal/deep/preview/hooks'],
        entryPoint: './src/preview/hooks.ts',
      },
      {
        exportEntries: ['./internal/deep/services/change-detection/node'],
        entryPoint: './src/services/change-detection/node.ts',
      },
      {
        exportEntries: ['./internal/deep/services/dev-server-subscriptions'],
        entryPoint: './src/services/dev-server-subscriptions.ts',
      },
      {
        exportEntries: ['./internal/deep/telemetry/ai-setup-utils'],
        entryPoint: './src/telemetry/ai-setup-utils.ts',
      },
      {
        exportEntries: ['./internal/deep/telemetry/event-cache'],
        entryPoint: './src/telemetry/event-cache.ts',
      },
      {
        exportEntries: ['./internal/deep/services/preset'],
        entryPoint: './src/services/preset.ts',
      },
      {
        exportEntries: ['./internal/deep/services/stores/status'],
        entryPoint: './src/services/stores/status.ts',
      },
      {
        exportEntries: ['./internal/deep/services/stores/test-provider'],
        entryPoint: './src/services/stores/test-provider.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/instance-context'],
        entryPoint: './src/shared/instance-context.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/errors'],
        entryPoint: './src/shared/open-service/errors.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/server'],
        entryPoint: './src/shared/open-service/server.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/service-error-serialization'],
        entryPoint: './src/shared/open-service/service-error-serialization.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/docgen/node'],
        entryPoint: './src/shared/open-service/services/docgen/node.ts',
        outputPath: '_node/shared/open-service/services/docgen/node',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/story-docs/node'],
        entryPoint: './src/shared/open-service/services/story-docs/node.ts',
        outputPath: '_node/shared/open-service/services/story-docs/node',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/toolset-definition'],
        entryPoint: './src/shared/open-service/toolset-definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/toolset-names'],
        entryPoint: './src/shared/open-service/toolset-names.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/toolset-rpc'],
        entryPoint: './src/shared/open-service/toolset-rpc.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/review/events'],
        entryPoint: './src/shared/review/events.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/test-provider-store/AddonVitestService.constants'],
        entryPoint: './src/shared/test-provider-store/AddonVitestService.constants.ts',
        outputPath: '_node/shared/test-provider-store/AddonVitestService.constants',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/shared/universal-store'],
        entryPoint: './src/shared/universal-store/index.ts',
        outputPath: '_node/shared/universal-store/index',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/story-index/ghost-stories/get-candidates'],
        entryPoint: './src/story-index/ghost-stories/get-candidates.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/ghost-stories/node'],
        entryPoint: './src/story-index/ghost-stories/node.ts',
        outputPath: '_node/story-index/ghost-stories/node',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/story-index/ghost-stories/run-story-tests'],
        entryPoint: './src/story-index/ghost-stories/run-story-tests.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/manifests/manifests'],
        entryPoint: './src/story-index/manifests/manifests.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/strip-comments-and-strings'],
        entryPoint: './src/story-index/strip-comments-and-strings.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/summarizeIndex'],
        entryPoint: './src/story-index/summarizeIndex.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/watch-story-specifiers'],
        entryPoint: './src/story-index/watch-story-specifiers.ts',
      },
      {
        exportEntries: ['./internal/deep/test/node'],
        entryPoint: './src/test/node.ts',
        outputPath: '_node/test/node',
        dts: false,
      },
      {
        exportEntries: ['./internal/deep/constants/agent-provenance'],
        entryPoint: './src/constants/agent-provenance.ts',
      },
      {
        exportEntries: ['./internal/deep/constants/environments-support'],
        entryPoint: './src/constants/environments-support.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/agent-environment'],
        entryPoint: './src/utils/agent-environment.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/ai-checklist-flags'],
        entryPoint: './src/utils/ai-checklist-flags.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/get-monorepo-type'],
        entryPoint: './src/utils/get-monorepo-type.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/local-hosts'],
        entryPoint: './src/utils/local-hosts.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/module'],
        entryPoint: './src/utils/module.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/node-libs'],
        entryPoint: './src/utils/node-libs.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/valibot'],
        entryPoint: './src/utils/valibot.ts',
      },
    ],
    browser: [
      {
        exportEntries: ['./internal/client-logger'],
        entryPoint: './src/client-logger/index.ts',
      },
      {
        exportEntries: ['./internal/instrumenter'],
        entryPoint: './src/test/instrumenter/index.ts',
      },
      {
        exportEntries: ['./test'],
        entryPoint: './src/test/index.ts',
      },
      {
        exportEntries: ['./preview-api', './internal/preview-api'],
        entryPoint: './src/preview-api/index.ts',
      },
      {
        exportEntries: ['./internal/preview/globals'],
        entryPoint: './src/preview/globals.ts',
      },
      {
        exportEntries: ['./internal/csf'],
        entryPoint: './src/csf/index.ts',
      },
      {
        exportEntries: ['./internal/csf/csf-utils'],
        entryPoint: './src/csf/csf-utils.ts',
      },
      {
        exportEntries: ['./internal/manager-errors'],
        entryPoint: './src/manager-errors.ts',
      },
      {
        exportEntries: ['./internal/preview-errors'],
        entryPoint: './src/preview-errors.ts',
      },
      {
        exportEntries: ['./internal/docs-tools'],
        entryPoint: './src/docs-tools/index.ts',
      },
      {
        exportEntries: ['./internal/core-events'],
        entryPoint: './src/core-events/index.ts',
      },
      {
        exportEntries: ['./internal/channels'],
        entryPoint: './src/channels/index.ts',
      },
      {
        exportEntries: ['./internal/types'],
        entryPoint: './src/types/index.ts',
      },
      {
        exportEntries: ['./open-service'],
        entryPoint: './src/shared/open-service/index.ts',
      },
      {
        // Dependency-light docs toolset surface bundled into `@storybook/mcp`'s dist (core is a
        // dev dependency there), replacing that package's own manifest-formatter copies. Portable:
        // its d.ts is one flat self-contained file so that consumer can inline it through standard
        // resolution; guarded by `portable-dist.test.ts` next to the entry source.
        exportEntries: ['./internal/toolsets-docs'],
        entryPoint: './src/shared/open-service/toolsets/docs/public.ts',
        portable: { external: ['valibot'] },
      },
      {
        exportEntries: ['./internal/deep/channels/mock-channel'],
        entryPoint: './src/channels/mock-channel.ts',
      },
      {
        exportEntries: ['./internal/deep/channels/telejson'],
        entryPoint: './src/channels/telejson.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/ansi-converter'],
        entryPoint: './src/utils/ansi-converter.ts',
      },
      {
        exportEntries: ['./internal/deep/instance/addons'],
        entryPoint: './src/instance/addons.ts',
      },
      {
        exportEntries: ['./internal/deep/preview-api/modules/preview-web/render/animation-utils'],
        entryPoint: './src/preview-api/modules/preview-web/render/animation-utils.ts',
      },
      {
        exportEntries: ['./internal/deep/preview/preview-navigator'],
        entryPoint: './src/preview/preview-navigator.ts',
      },
      {
        exportEntries: ['./internal/deep/preview/utils'],
        entryPoint: './src/preview/utils.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/checklist-store'],
        entryPoint: './src/shared/checklist-store/index.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/checklist-store/checklistData.state'],
        entryPoint: './src/shared/checklist-store/checklistData.state.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/manager'],
        entryPoint: './src/shared/open-service/manager.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/docgen/definition'],
        entryPoint: './src/shared/open-service/services/docgen/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/docgen/node'],
        entryPoint: './src/shared/open-service/services/docgen/node.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/review/definition'],
        entryPoint: './src/shared/open-service/services/review/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/review/state-transitions'],
        entryPoint: './src/shared/open-service/services/review/state-transitions.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/story-docs/node'],
        entryPoint: './src/shared/open-service/services/story-docs/node.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/sync-test/addon/constants'],
        entryPoint: './src/shared/open-service/sync-test/addon/constants.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/sync-test/addon/services'],
        entryPoint: './src/shared/open-service/sync-test/addon/services.ts',
      },
      {
        exportEntries: [
          './internal/deep/shared/open-service/sync-test/concurrent-writes/definition',
        ],
        entryPoint: './src/shared/open-service/sync-test/concurrent-writes/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/sync-test/local-command/definition'],
        entryPoint: './src/shared/open-service/sync-test/local-command/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/sync-test/remote-command/definition'],
        entryPoint: './src/shared/open-service/sync-test/remote-command/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/sync-test/static-load/definition'],
        entryPoint: './src/shared/open-service/sync-test/static-load/definition.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/review/routes'],
        entryPoint: './src/shared/review/routes.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/router/utils'],
        entryPoint: './src/shared/router/utils.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/status-store'],
        entryPoint: './src/shared/status-store/index.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/test-provider-store'],
        entryPoint: './src/shared/test-provider-store/index.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/test-provider-store/AddonVitestService.constants'],
        entryPoint: './src/shared/test-provider-store/AddonVitestService.constants.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/toolbar/constants'],
        entryPoint: './src/shared/toolbar/constants.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/universal-store'],
        entryPoint: './src/shared/universal-store/index.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/universal-store/mock'],
        entryPoint: './src/shared/universal-store/mock.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/universal-store/use-universal-store-manager'],
        entryPoint: './src/shared/universal-store/use-universal-store-manager.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/viewport/constants'],
        entryPoint: './src/shared/viewport/constants.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/viewport/defaults'],
        entryPoint: './src/shared/viewport/defaults.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/viewport/resolveViewport'],
        entryPoint: './src/shared/viewport/resolveViewport.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/viewport/types'],
        entryPoint: './src/shared/viewport/types.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/ghost-stories/node'],
        entryPoint: './src/story-index/ghost-stories/node.ts',
      },
      { exportEntries: ['./internal/deep/test/node'], entryPoint: './src/test/node.ts' },
      {
        exportEntries: ['./internal/deep/test/preview'],
        entryPoint: './src/test/preview.ts',
      },
      {
        exportEntries: ['./internal/deep/story-index/ghost-stories/test-annotations'],
        entryPoint: './src/story-index/ghost-stories/test-annotations.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/docgen/preview'],
        entryPoint: './src/shared/open-service/services/docgen/preview.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/story-docs/preview'],
        entryPoint: './src/shared/open-service/services/story-docs/preview.ts',
      },
      {
        exportEntries: ['./internal/deep/types/modules/router'],
        entryPoint: './src/types/modules/router.ts',
      },
      {
        exportEntries: ['./internal/deep/types/modules/theming'],
        entryPoint: './src/types/modules/theming.ts',
      },
      {
        exportEntries: ['./internal/deep/constants/iframe-resize'],
        entryPoint: './src/constants/iframe-resize.ts',
      },
      {
        exportEntries: ['./internal/deep/constants/tags'],
        entryPoint: './src/constants/tags.ts',
      },
      {
        exportEntries: ['./internal/deep/types/legacy-icons'],
        entryPoint: './src/types/legacy-icons.ts',
      },
      {
        exportEntries: ['./internal/deep/types/toolbar'],
        entryPoint: './src/types/toolbar.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/ai-prompts'],
        entryPoint: './src/utils/ai-prompts.ts',
      },
      {
        exportEntries: ['./internal/deep/utils/story-index-filters'],
        entryPoint: './src/utils/story-index-filters.ts',
      },
    ],
    runtime: [
      /**
       * It is required to be a runtime entry point, because it is used to inject the mocker runtime
       * into the preview iframe in builder-vite and builder-webpack5. To guarantee that the mocker
       * runtime is transpiled correctly, code splitting needs to be disabled for this entry point.
       */
      {
        exportEntries: ['./internal/mocking-utils/mocker-runtime'],
        entryPoint: './src/test/mocking/mocker-runtime.js',
        dts: false,
      },
    ],
  },
};

export default config;
