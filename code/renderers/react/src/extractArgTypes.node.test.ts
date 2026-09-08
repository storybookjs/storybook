import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { dedent } from 'ts-dedent';

import { parseWithReactDocgen } from './componentManifest/reactDocgen.ts';
import { extractArgTypes } from './extractArgTypes.ts';

/** Resolve the real node_modules directory (may be hoisted to the workspace root). */
const NODE_MODULES_DIR = resolve(require.resolve('react/package.json'), '../..');

describe('extractArgTypes node props (#11429)', () => {
  // The docgen importer resolves imports from the fixture's directory with the real fs, so the
  // fixture lives in a temp project with the packages it imports copied in from the workspace
  // (same approach as componentMeta/test-helpers.ts).
  const makeTempProject = (files: Record<string, string>): string => {
    const projectDir = mkdtempSync(join(tmpdir(), 'argtypes-node-test-'));
    for (const pkg of ['react', 'prop-types']) {
      cpSync(join(NODE_MODULES_DIR, pkg), join(projectDir, 'node_modules', pkg), {
        recursive: true,
        dereference: true,
      });
    }
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(projectDir, name), content);
    }
    return projectDir;
  };

  it('maps PropTypes.node to the renderer-tagged node type', () => {
    const componentCode = dedent`
      import React from 'react';
      import PropTypes from 'prop-types';

      const Badge = ({ children, label }) => <span>{children}</span>;
      Badge.propTypes = {
        children: PropTypes.node,
        label: PropTypes.string,
      };
      export default Badge;
    `;
    const projectDir = makeTempProject({ 'Badge.jsx': componentCode });

    const docgen = parseWithReactDocgen(componentCode, `${projectDir}/Badge.jsx`);
    const argTypes = extractArgTypes({ __docgenInfo: docgen?.[0] });

    expect(argTypes?.children.type).toEqual({
      name: 'node',
      renderer: 'react',
      required: false,
    });
    expect(argTypes?.label.type).toEqual({ name: 'string', required: false });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('maps React.ReactNode to the renderer-tagged node type (react-docgen-typescript shape)', () => {
    // Shape produced by react-docgen-typescript: raw props with a `type` name (verified against
    // the real RDT pipeline — `React.ReactNode` resolves to the type name `ReactNode`).
    const argTypes = extractArgTypes({
      __docgenInfo: {
        displayName: 'Card',
        props: {
          children: { name: 'children', required: true, type: { name: 'ReactNode' } },
        },
      },
    });

    expect(argTypes?.children.type).toEqual({
      name: 'node',
      renderer: 'react',
      required: true,
    });
  });

  it('maps babel-plugin tsType node spellings to the renderer-tagged node type', () => {
    // Shape produced by babel-plugin-react-docgen: `tsType` without `type`. `ReactReactNode` is
    // its concatenation for `React.ReactNode` (see the 10017-ts-union fixture).
    const argTypes = extractArgTypes({
      __docgenInfo: {
        displayName: 'Card',
        props: {
          header: {
            name: 'header',
            required: false,
            tsType: { name: 'ReactNode', raw: 'React.ReactNode' },
          },
          footer: {
            name: 'footer',
            required: true,
            tsType: { name: 'ReactReactNode', raw: 'React.ReactNode' },
          },
        },
      },
    });

    expect(argTypes?.header.type).toEqual({
      name: 'node',
      renderer: 'react',
      required: false,
    });
    expect(argTypes?.footer.type).toEqual({
      name: 'node',
      renderer: 'react',
      required: true,
    });
  });

  it('keeps element-ish and node-array types on the object editor', () => {
    const argTypes = extractArgTypes({
      __docgenInfo: {
        displayName: 'Card',
        props: {
          icon: {
            name: 'icon',
            required: true,
            tsType: { name: 'ReactElement', raw: 'React.ReactElement' },
          },
          nodes: {
            name: 'nodes',
            required: true,
            tsType: { name: 'ReactNode[]', raw: 'React.ReactNode[]' },
          },
          union: {
            name: 'union',
            required: true,
            tsType: {
              name: 'union',
              raw: 'React.ReactNode | string',
              elements: [{ name: 'ReactReactNode', raw: 'React.ReactNode' }, { name: 'string' }],
            },
          },
        },
      },
    });

    expect(argTypes?.icon.type).toEqual({
      name: 'other',
      value: 'ReactElement',
      raw: 'React.ReactElement',
      required: true,
    });
    expect(argTypes?.nodes.type).toEqual({
      name: 'other',
      value: 'ReactNode[]',
      raw: 'React.ReactNode[]',
      required: true,
    });
    expect(argTypes?.union.type).toMatchObject({ name: 'union' });
  });
});
