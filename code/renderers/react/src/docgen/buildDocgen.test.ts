import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';
import ts from 'typescript';

import { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import {
  cleanup,
  createTempDir,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { buildDocgenPayload } from './buildDocgen.ts';

let tempDir: string | undefined;
let manager: ComponentMetaManager | undefined;

afterEach(() => {
  manager?.dispose();
  manager = undefined;
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

describe('buildDocgenPayload', () => {
  it(
    'extracts name, description, props, and a snippet for one component',
    { timeout: 30_000 },
    async () => {
      tempDir = createTempDir('docgen-build');

      const files = writeFiles(tempDir, {
        'tsconfig.json': tsconfigJSON(),
        'Button.tsx': dedent`
          import React from 'react';
          /**
           * A clickable button.
           */
          export const Button = (_props: { label: string; disabled?: boolean }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button, title: 'Forms/Button' };
          export const Primary = () => <Button label="hi" />;
        `,
      });

      manager = new ComponentMetaManager(ts);

      const payload = await buildDocgenPayload(
        { importPath: files['Button.stories.tsx'] },
        {
          manager,
          resolvePath: (importPath) =>
            path.isAbsolute(importPath) ? importPath : path.join(tempDir!, importPath),
        }
      );

      expect(payload).toBeDefined();
      expect(payload!.name).toBe('Button');
      expect(payload!.description).toContain('clickable button');
      // props are typed `unknown` in the core contract; cast to the React provider's shape here.
      const props = payload!.props as Array<{ name: string; required: boolean }>;
      expect(props.map((p) => p.name).sort()).toEqual(['disabled', 'label']);
      const labelProp = props.find((p) => p.name === 'label');
      expect(labelProp?.required).toBe(true);
      expect(payload!.stories).toHaveLength(1);
      expect(payload!.stories?.[0]).toMatchObject({
        id: expect.stringMatching(/--primary$/),
        name: 'Primary',
      });
      expect(payload!.stories?.[0].snippet).toMatch(/<Button label="hi"/);
    }
  );

  it('returns undefined when the story file is missing', { timeout: 15_000 }, async () => {
    tempDir = createTempDir('docgen-build');
    manager = new ComponentMetaManager(ts);

    const payload = await buildDocgenPayload(
      { importPath: 'does-not-exist.stories.tsx' },
      {
        manager,
        resolvePath: (importPath) => path.join(tempDir!, importPath),
      }
    );

    expect(payload).toBeUndefined();
  });

  it('walks declared subcomponents into the subcomponents field', { timeout: 30_000 }, async () => {
    tempDir = createTempDir('docgen-build');

    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Card.tsx': dedent`
          import React from 'react';
          export const Card = (_props: { title: string }) => <div />;
          export const CardHeader = (_props: { level?: number }) => <header />;
        `,
      'Card.stories.tsx': dedent`
          import { Card, CardHeader } from './Card';
          export default {
            component: Card,
            subcomponents: { CardHeader },
            title: 'Layout/Card',
          };
          // Render CardHeader so RCM can extract its props from the JSX.
          export const Default = () => (
            <Card title="x">
              <CardHeader level={1} />
            </Card>
          );
        `,
    });

    manager = new ComponentMetaManager(ts);

    const payload = await buildDocgenPayload(
      { importPath: files['Card.stories.tsx'] },
      {
        manager,
        resolvePath: (importPath) =>
          path.isAbsolute(importPath) ? importPath : path.join(tempDir!, importPath),
      }
    );

    expect(payload).toBeDefined();
    expect(payload!.name).toBe('Card');
    expect(payload!.subcomponents).toBeDefined();
    expect(Object.keys(payload!.subcomponents ?? {})).toEqual(['CardHeader']);
    const headerProps = (payload!.subcomponents?.CardHeader.props ?? []) as Array<{
      name: string;
    }>;
    expect(headerProps.map((p) => p.name)).toContain('level');
  });
});
