import { defineEntry } from '../../../scripts/prepare/tools';

export const getEntries = (cwd: string) => {
  const define = defineEntry(cwd);
  return [
    // empty, right now, TDB what to do with this
    define('src/index.ts', ['node', 'browser'], true),

    define('src/node-logger/index.ts', ['node'], true),
    define('src/client-logger/index.ts', ['browser', 'node'], true),

    define('src/core-server/index.ts', ['node'], true),
    define('src/core-server/presets/common-preset.ts', ['node'], false),
    define('src/core-server/presets/common-manager.ts', ['browser'], false),
    define('src/core-server/presets/common-override-preset.ts', ['node'], false),

    define('src/core-events/index.ts', ['browser', 'node'], true),
    define('src/manager-errors.ts', ['browser'], true),
    define('src/preview-errors.ts', ['browser', 'node'], true),
    define('src/server-errors.ts', ['node'], true),

    define('src/channels/index.ts', ['browser', 'node'], true),
    define('src/types/index.ts', ['browser', 'node'], true, ['react']),
    define('src/csf-tools/index.ts', ['node'], true),
    define('src/common/index.ts', ['node'], true),
    define('src/builder-manager/index.ts', ['node'], true),
    define('src/telemetry/index.ts', ['node'], true),
    define('src/preview-api/index.ts', ['browser', 'node'], true),
    define('src/manager-api/index.ts', ['browser', 'node'], true, ['react']),
    define('src/router/index.ts', ['browser', 'node'], true, ['react']),
    define('src/components/index.ts', ['browser', 'node'], true, ['react', 'react-dom']),
    define('src/theming/index.ts', ['browser', 'node'], true, ['react']),
    define('src/theming/create.ts', ['browser', 'node'], true, ['react']),
    define('src/docs-tools/index.ts', ['browser', 'node'], true),

    define('src/manager/globals-module-info.ts', ['node'], true),
    define('src/manager/globals.ts', ['node'], true),
    define('src/preview/globals.ts', ['node'], true),
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
    define('src/manager/runtime.ts', ['browser'], false),
  ];
};
