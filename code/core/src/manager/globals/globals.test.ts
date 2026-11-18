import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

import { type Plugin, build } from 'rolldown';
import { beforeAll, describe, expect, it } from 'vitest';

import { globalExternals } from '../../builder-manager/utils/global-externals.ts';
import { globalsModuleInfoMap } from './globals-module-info.ts';
import { globalsNameReferenceMap } from './globals.ts';

const bundle = async (
  input: string,
  name: string,
  options: { mode: string; plugins: Plugin[]; minify?: boolean }
) => {
  const { output } = await build({
    input,
    write: false,
    platform: 'browser',
    logLevel: 'silent',
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify(options.mode) } },
    plugins: options.plugins,
    output: { format: 'iife', name, minify: options.minify },
  });
  return output[0].code;
};

const EMPTY = '\0empty:';
const ADDON = '\0addon';

let managerBundle: string;

beforeAll(async () => {
  managerBundle = await bundle(fileURLToPath(new URL('./runtime.ts', import.meta.url)), 'manager', {
    mode: 'production',
    plugins: [
      {
        name: 'unrelated-manager-globals',
        resolveId(id, importer) {
          const isPackage = importer && /^[^./]/.test(id) && !id.startsWith(EMPTY);
          return isPackage && id !== 'react' && !id.startsWith('react/') ? EMPTY + id : null;
        },
        load(id) {
          return id.startsWith(EMPTY) ? 'module.exports = {};' : null;
        },
      },
    ],
  });
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

    const addonBundle = await bundle(ADDON, 'addon', {
      mode,
      minify: mode === 'production',
      plugins: [
        {
          name: 'addon',
          resolveId(id) {
            return id === ADDON ? ADDON : null;
          },
          load(id) {
            return id === ADDON
              ? `
                ${imports}
                export const ref = React.createRef();
                export const classic = React.createElement('span', { children: 'classic' });
                export const single = jsx('button', { ref, children: 'single' }, 'single');
                export const multiple = jsxs(Fragment, { children: [classic, single] });
                export const development = jsxDEV('button', { ref, children: 'development' }, 'dev', false, { fileName: 'addon.tsx', lineNumber: 1 }, undefined);
              `
              : null;
          },
        },
        globalExternals(globalsModuleInfoMap),
        {
          name: 'no-project-react',
          resolveId(id) {
            if (/^react(?:\/|$)/.test(id)) {
              throw new Error(`Unexpected project dependency: ${id}`);
            }
            return null;
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
    runInContext(addonBundle, context);

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
