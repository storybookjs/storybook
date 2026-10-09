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
          builder.onResolve({ filter: /^[^./]/ }, ({ path }) => {
            if (path === 'react' || path.startsWith('react/')) {
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
