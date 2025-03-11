import { defineEntry } from '../../../scripts/prepare/tools';

export const getEntries = (cwd: string) => {
  const define = defineEntry(cwd);
  return [
    // empty, right now, TDB what to do with this
    define('src/index.ts', ['node', 'browser'], true, ['react']),

    define('src/node-logger/index.ts', ['node'], true, ['react']),
    define('src/client-logger/index.ts', ['browser', 'node'], true, ['react']),

    define('src/theming/index.ts', ['browser', 'node'], true, ['react']),
    define('src/theming/create.ts', ['browser', 'node'], true, ['react']),

    define('src/core-server/index.ts', ['node'], true, ['react']),
    define('src/core-server/presets/common-preset.ts', ['node'], false, ['react']),
    define('src/core-server/presets/common-manager.ts', ['browser'], false, ['react']),
    define('src/core-server/presets/common-override-preset.ts', ['node'], false, ['react']),

    define('src/actions/index.ts', ['browser', 'node'], true, ['react'], [], [], true),
    define('src/actions/preview.ts', ['browser', 'node'], true, ['react'], [], [], true),
    define('src/actions/manager.tsx', ['browser'], false, ['react'], [], [], true),
    define('src/actions/decorator.ts', ['browser'], true, ['react'], [], [], true),

    define('src/core-events/index.ts', ['browser', 'node'], true, ['react']),
    define('src/manager-errors.ts', ['browser'], true, ['react']),
    define('src/preview-errors.ts', ['browser', 'node'], true, ['react']),
    define('src/server-errors.ts', ['node'], true, ['react']),

    define('src/channels/index.ts', ['browser', 'node'], true, ['react']),
    define('src/types/index.ts', ['browser', 'node'], true, ['react']),
    define('src/csf-tools/index.ts', ['node'], true, ['react']),
    define('src/csf/index.ts', ['browser', 'node'], true, ['react']),
    define('src/common/index.ts', ['node'], true, ['react']),
    define('src/builder-manager/index.ts', ['node'], true, ['react']),
    define('src/telemetry/index.ts', ['node'], true, ['react']),
    define('src/preview-api/index.ts', ['browser', 'node'], true, ['react']),
    define('src/manager-api/index.ts', ['browser', 'node'], true, ['react']),
    define('src/router/index.ts', ['browser', 'node'], true, ['react']),
    define(
      'src/components/index.ts',
      ['browser', 'node'],
      true,
      ['react', 'react-dom'],
      ['prettier'] // the syntax highlighter uses prettier/standalone to format the code
    ),
    define('src/docs-tools/index.ts', ['browser', 'node'], true, ['react']),

    define('src/manager/globals-module-info.ts', ['node'], true, ['react']),
    define('src/manager/globals.ts', ['node'], true, ['react']),
    define('src/preview/globals.ts', ['node'], true, ['react']),
    define('src/cli/index.ts', ['node'], true, ['react']),
    define('src/babel/index.ts', ['node'], true, ['react']),
    define('src/cli/bin/index.ts', ['node'], true, ['react']),
    define('src/bin/index.ts', ['node'], false, ['react']),

    define('src/instrumenter/index.ts', ['browser', 'node'], true, ['react']),
    define(
      'src/test/preview.ts',
      ['browser', 'node'],
      true,
      ['util', 'react'],
      [],
      [
        '@testing-library/dom',
        '@testing-library/jest-dom',
        '@testing-library/user-event',
        'chai',
        '@vitest/expect',
        '@vitest/spy',
        '@vitest/utils',
      ],
      true
    ),
    define(
      'src/test/index.ts',
      ['browser', 'node'],
      true,
      ['util', 'react'],
      [],
      [
        '@testing-library/dom',
        '@testing-library/jest-dom',
        '@testing-library/user-event',
        'chai',
        '@vitest/expect',
        '@vitest/spy',
        '@vitest/utils',
      ],
      true
    ),
  ];
};

// entries for injecting globals into the preview and manager
export const getBundles = (cwd: string) => {
  const define = defineEntry(cwd);

  return [
    //
    define('src/preview/runtime.ts', ['browser'], false),
    define('src/manager/globals-runtime.ts', ['browser'], false),
  ];
};

// the runtime for the manager
export const getFinals = (cwd: string) => {
  const define = defineEntry(cwd);

  return [
    //
    define('src/manager/runtime.tsx', ['browser'], false),
  ];
};
