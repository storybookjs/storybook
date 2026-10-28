import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

import { beforeAll, describe, expect, it } from 'vitest';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { build } from 'esbuild';

import { globalsModuleInfoMap } from './globals-module-info.ts';
import { globalsNameReferenceMap } from './globals.ts';

let managerBundle: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./runtime.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'manager',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'unrelated-manager-globals',
        setup(builder) {
          builder.onResolve({ filter: /^[^./]/ }, ({ path, kind }) => {
            if (kind === 'entry-point' || path === 'react' || path.startsWith('react/')) {
              return;
            }
            return { path, namespace: 'empty' };
          });
          builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export {}' }));
        },
      },
    ],
  });
  managerBundle = result.outputFiles[0].text;
});

describe.each(['development', 'production'])('%s manager entries', (mode) => {
  it.each(['esm', 'cjs'])('shares React and JSX runtimes with a %s addon', async (format) => {
    const imports =
      format === 'esm'
        ? `
          import * as React from 'react';
          import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
          import { jsxDEV } from 'react/jsx-dev-runtime';
        `
        : `
          const React = require('react');
          const { Fragment, jsx, jsxs } = require('react/jsx-runtime');
          const { jsxDEV } = require('react/jsx-dev-runtime');
        `;

    const result = await build({
      stdin: {
        contents: `
          ${imports}
          export const ref = React.createRef();
          export const classic = React.createElement('span', { children: 'classic' });
          export const single = jsx('button', { ref, children: 'single' }, 'single');
          export const multiple = jsxs(Fragment, { children: [classic, single] });
          export const development = jsxDEV('button', { ref, children: 'development' }, 'dev', false, { fileName: 'addon.tsx', lineNumber: 1 }, undefined);
        `,
        resolveDir: import.meta.dirname,
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'addon',
      platform: 'browser',
      minify: mode === 'production',
      define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
      plugins: [
        globalExternals(globalsModuleInfoMap),
        {
          name: 'no-project-react',
          setup(builder) {
            builder.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => {
              throw new Error(`Unexpected project dependency: ${path}`);
            });
          },
        },
      ],
    });

    const context = createContext({});
    runInContext(managerBundle, context);
    const globals = context.manager.globalsNameValueMap;
    for (const [name, value] of Object.entries(globalsNameReferenceMap)) {
      context[value] = globals[name];
    }
    runInContext(result.outputFiles[0].text, context);

    const { classic, single, multiple, development, ref } = context.addon;
    expect([classic, single, multiple, development].every(globals.react.isValidElement)).toBe(true);
    expect(single).toMatchObject({ type: 'button', key: 'single', props: { children: 'single' } });
    expect(single.ref).toBe(ref);
    expect(multiple.type).toBe(globals.react.Fragment);
    expect(multiple.props.children).toEqual([classic, single]);
    expect(development).toMatchObject({
      type: 'button',
      key: 'dev',
      props: { children: 'development' },
    });
    expect(development.ref).toBe(ref);
  });
});

const LOWER_PACKAGES = ['@storybook/core', '@storybook/ui', '@storybook/manager'];

describe('globals module info', () => {
  it('maps every lower-package specifier of a globalized key to the same global', () => {
    const require = createRequire(import.meta.url);
    const lowerSpecifiers = LOWER_PACKAGES.flatMap((pkg) =>
      Object.keys(require(`${pkg}/package.json`).exports).map((key) => `${pkg}${key.slice(1)}`)
    );
    const twins = Object.entries(globalsNameReferenceMap).flatMap(([key, global]) =>
      LOWER_PACKAGES.map((pkg) => `${pkg}${key.slice('storybook'.length)}`)
        .filter((specifier) => key.startsWith('storybook/') && lowerSpecifiers.includes(specifier))
        .map((specifier) => [specifier, global])
    );

    expect(
      twins.map(([specifier]) => [
        specifier,
        globalsModuleInfoMap[specifier as keyof typeof globalsModuleInfoMap]?.varName,
      ])
    ).toEqual(twins);
    expect(Object.fromEntries(twins)).toMatchInlineSnapshot(`
      {
        "@storybook/core/internal/channels": "__STORYBOOK_CHANNELS__",
        "@storybook/core/internal/client-logger": "__STORYBOOK_CLIENT_LOGGER__",
        "@storybook/core/internal/core-events": "__STORYBOOK_CORE_EVENTS__",
        "@storybook/core/internal/manager-errors": "__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__",
        "@storybook/core/internal/types": "__STORYBOOK_TYPES__",
        "@storybook/core/test": "__STORYBOOK_TEST__",
        "@storybook/manager/internal/router": "__STORYBOOK_ROUTER__",
        "@storybook/manager/manager-api": "__STORYBOOK_API__",
        "@storybook/ui/internal/components": "__STORYBOOK_COMPONENTS__",
        "@storybook/ui/theming": "__STORYBOOK_THEMING__",
        "@storybook/ui/theming/create": "__STORYBOOK_THEMING_CREATE__",
      }
    `);
  });
});
