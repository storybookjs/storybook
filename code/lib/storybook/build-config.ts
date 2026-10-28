import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';
import { copyRuntimes } from './scripts/copy-runtimes.ts';

const CODE_DIR = path.join(import.meta.dirname, '../..');

// `postbuild` runs once per bundling context; copy once.
let copiedRuntimes: Promise<void> | undefined;

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
  postbuild: (cwd) => (copiedRuntimes ??= copyRuntimes(cwd, CODE_DIR)),
  extraOutputs: {
    './internal/mocking-utils/mocker-runtime': './dist/core/test/mocking/mocker-runtime.js',
  },
  entries: {
    node: [
      {
        // The `main.ts` subset of `@storybook/core`'s root; plugin authors import core directly.
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./internal/instance'],
        entryPoint: './src/storybook/instance.ts',
        outputPath: 'core/instance/index',
      },
      {
        exportEntries: ['./internal/preview-page'],
        entryPoint: './src/storybook/preview-page.ts',
        outputPath: 'core/preview-page/index',
      },
      {
        exportEntries: ['./internal/server'],
        entryPoint: './src/storybook/server/index.ts',
      },
      {
        exportEntries: ['./internal/bin/dispatcher'],
        entryPoint: './src/storybook/bin/dispatcher.ts',
        outputPath: 'bin/dispatcher',
        dts: false,
      },
      {
        entryPoint: './src/storybook/bin/core.ts',
        dts: false,
      },
      {
        entryPoint: './src/storybook/cli/index.ts',
        exportEntries: ['./internal/cli'],
      },
      {
        exportEntries: ['./internal/tools'],
        entryPoint: './src/shims/internal/tools.ts',
        outputPath: 'storybook/cli/tools/sdk/index',
      },
      {
        exportEntries: ['./internal/tools/child-host'],
        entryPoint: './src/shims/internal/tools-child-host.ts',
        outputPath: 'storybook/cli/tools/sdk/child-host',
        dts: false,
      },
      // Keys owned by a lower package: one-file re-export shims at today's output paths.
      {
        exportEntries: ['./internal/node-logger'],
        entryPoint: './src/shims/internal/node-logger.ts',
        outputPath: 'core/node-logger/index',
      },
      {
        exportEntries: ['./internal/server-errors'],
        entryPoint: './src/shims/internal/server-errors.ts',
        outputPath: 'core/server-errors',
      },
      {
        exportEntries: ['./internal/story-index'],
        entryPoint: './src/shims/internal/story-index.ts',
        outputPath: 'core/story-index/index',
      },
      {
        exportEntries: ['./internal/services'],
        entryPoint: './src/shims/internal/services.ts',
        outputPath: 'core/services/index',
      },
      {
        exportEntries: ['./internal/core-server'],
        entryPoint: './src/shims/internal/core-server.ts',
        outputPath: 'storybook/core-server/index',
      },
      {
        exportEntries: ['./internal/oxc-parser'],
        entryPoint: './src/shims/internal/oxc-parser.ts',
        outputPath: 'core/oxc-parser/index',
      },
      {
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/shims/internal/docgen-worker.ts',
        outputPath: 'core/shared/open-service/services/docgen/worker/docgen-worker',
        dts: false,
      },
      {
        exportEntries: ['./internal/telemetry'],
        entryPoint: './src/shims/internal/telemetry.ts',
        outputPath: 'core/telemetry/index',
      },
      {
        exportEntries: ['./internal/csf-tools'],
        entryPoint: './src/shims/internal/csf-tools.ts',
        outputPath: 'core/csf-tools/index',
      },
      {
        exportEntries: ['./internal/bin/loader'],
        entryPoint: './src/shims/internal/bin/loader.ts',
        outputPath: 'storybook/bin/loader',
        dts: false,
      },
      {
        exportEntries: ['./internal/common'],
        entryPoint: './src/shims/internal/common.ts',
        outputPath: 'core/common/index',
      },
      {
        exportEntries: ['./internal/component-meta'],
        entryPoint: './src/shims/internal/component-meta.ts',
        outputPath: 'core/component-meta/index',
      },
      {
        exportEntries: ['./internal/mocking-utils'],
        entryPoint: './src/shims/internal/mocking-utils.ts',
        outputPath: 'core/test/mocking/index',
      },
    ],
    browser: [
      {
        exportEntries: ['./highlight'],
        entryPoint: './src/features/highlight/index.ts',
      },
      {
        exportEntries: ['./actions'],
        entryPoint: './src/features/actions/index.ts',
      },
      {
        exportEntries: ['./actions/decorator'],
        entryPoint: './src/features/actions/decorator.ts',
      },
      {
        exportEntries: ['./backgrounds'],
        entryPoint: './src/features/backgrounds/index.ts',
      },
      {
        exportEntries: ['./viewport'],
        entryPoint: './src/features/viewport/index.ts',
      },
      {
        // Composes the core annotations; listed in `sideEffects`.
        exportEntries: ['./internal/csf'],
        entryPoint: './src/storybook/preview/csf.ts',
        outputPath: 'core/csf/index',
      },
      {
        entryPoint: './src/storybook/server/presets/common-manager.ts',
        dts: false,
      },
      {
        // Pure skill-content builders shared by the skills CLI and addon-mcp so both consumers render
        // the same instruction documents. Not portable: consumers resolve core normally.
        exportEntries: ['./internal/skills'],
        entryPoint: './src/storybook/cli/skills/content/index.ts',
      },
      {
        exportEntries: ['./internal/client-logger'],
        entryPoint: './src/shims/internal/client-logger.ts',
        outputPath: 'core/client-logger/index',
      },
      {
        exportEntries: ['./internal/instrumenter'],
        entryPoint: './src/shims/internal/instrumenter.ts',
        outputPath: 'core/test/instrumenter/index',
      },
      {
        exportEntries: ['./test'],
        entryPoint: './src/shims/test.ts',
        outputPath: 'core/test/index',
      },
      // Composes the core annotations; listed in `sideEffects`.
      {
        exportEntries: ['./preview-api', './internal/preview-api'],
        entryPoint: './src/shims/preview-api.ts',
        outputPath: 'core/preview-api/index',
      },
      {
        exportEntries: ['./internal/preview/globals'],
        entryPoint: './src/shims/internal/preview/globals.ts',
        outputPath: 'core/preview/globals',
      },
      {
        exportEntries: ['./internal/csf/csf-utils'],
        entryPoint: './src/shims/internal/csf/csf-utils.ts',
        outputPath: 'core/csf/csf-utils',
      },
      {
        exportEntries: ['./internal/manager-errors'],
        entryPoint: './src/shims/internal/manager-errors.ts',
        outputPath: 'shared/manager-errors',
      },
      {
        exportEntries: ['./internal/preview-errors'],
        entryPoint: './src/shims/internal/preview-errors.ts',
        outputPath: 'core/preview-errors',
      },
      {
        exportEntries: ['./internal/docs-tools'],
        entryPoint: './src/shims/internal/docs-tools.ts',
        outputPath: 'core/docs-tools/index',
      },
      {
        exportEntries: ['./internal/core-events'],
        entryPoint: './src/shims/internal/core-events.ts',
        outputPath: 'core/core-events/index',
      },
      {
        exportEntries: ['./internal/channels'],
        entryPoint: './src/shims/internal/channels.ts',
        outputPath: 'core/channels/index',
      },
      {
        exportEntries: ['./internal/types'],
        entryPoint: './src/shims/internal/types.ts',
        outputPath: 'core/types/index',
      },
      {
        exportEntries: ['./open-service'],
        entryPoint: './src/shims/open-service.ts',
        outputPath: 'core/shared/open-service/index',
      },
      {
        exportEntries: ['./internal/toolsets-docs'],
        entryPoint: './src/shims/internal/toolsets-docs.ts',
        outputPath: 'core/shared/open-service/toolsets/docs/public',
        portable: { external: ['valibot'] },
      },
      {
        exportEntries: ['./theming'],
        entryPoint: './src/shims/theming.ts',
        outputPath: 'manager/theming/index',
      },
      {
        exportEntries: ['./theming/create'],
        entryPoint: './src/shims/theming/create.ts',
        outputPath: 'manager/theming/create',
      },
      {
        exportEntries: ['./internal/components'],
        entryPoint: './src/shims/internal/components.ts',
        outputPath: 'manager/components/index',
      },
      {
        exportEntries: ['./internal/tour-guide'],
        entryPoint: './src/shims/internal/tour-guide.ts',
      },
      {
        exportEntries: ['./manager-api'],
        entryPoint: './src/shims/manager-api.ts',
        outputPath: 'manager/manager-api/index',
      },
      {
        exportEntries: ['./internal/router'],
        entryPoint: './src/shims/internal/router.ts',
        outputPath: 'manager/router/index',
      },
      {
        exportEntries: ['./internal/manager/globals'],
        entryPoint: './src/shims/internal/manager/globals.ts',
        outputPath: 'manager/ui/globals',
      },
      {
        exportEntries: ['./internal/manager/manager-stores'],
        entryPoint: './src/shims/internal/manager/manager-stores.ts',
        outputPath: 'manager/ui/manager-stores',
      },
      {
        // Throws a migration error: the runtime itself is only in `@storybook/manager`.
        exportEntries: ['./internal/manager/globals-runtime'],
        entryPoint: './src/shims/internal/manager/globals-runtime.ts',
        outputPath: 'manager/ui/globals-runtime',
        dts: false,
      },
    ],
    runtime: [
      {
        // Composes the core annotations in `setup`; listed in `sideEffects`.
        exportEntries: ['./internal/preview/runtime'],
        entryPoint: './src/storybook/preview/runtime.ts',
        outputPath: 'core/preview/runtime',
        dts: false,
        chunkedRuntime: true,
      },
    ],
  },
};

export default config;
