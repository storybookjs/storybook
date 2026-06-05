import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';
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
let componentMetaManager: ComponentMetaManager | undefined;

function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

afterEach(() => {
  componentMetaManager?.dispose();
  componentMetaManager = undefined;
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
           * @summary The primary action button.
           */
          export const Button = (_props: { label: string; disabled?: boolean }) => <button />;
        `,
        'Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default { component: Button, title: 'Forms/Button' };
          export const Primary = () => <Button label="hi" />;
        `,
      });

      componentMetaManager = new ComponentMetaManager(ts);
      const importPath = files['Button.stories.tsx'];

      const payload = await buildDocgenPayload(
        { entry: makeStoryIndexEntry(importPath, 'Forms/Button') },
        {
          componentMetaManager,
          resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
        }
      );

      expect(payload).toBeDefined();
      expect(payload!.id).toBe('button');
      expect(payload!.name).toBe('Button');
      expect(payload!.path).toBe(importPath);
      expect(payload!.description).toContain('clickable button');
      expect(payload!.summary).toBe('The primary action button.');
      expect(Object.keys(payload!.reactComponentMeta?.props ?? {}).sort()).toEqual([
        'disabled',
        'label',
      ]);
      expect(payload!.reactComponentMeta?.props.label.required).toBe(true);
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
    componentMetaManager = new ComponentMetaManager(ts);

    const payload = await buildDocgenPayload(
      {
        entry: makeStoryIndexEntry('does-not-exist.stories.tsx', 'Missing/Component'),
      },
      {
        componentMetaManager,
        resolvePath: (p) => path.join(tempDir!, p),
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

    componentMetaManager = new ComponentMetaManager(ts);

    const payload = await buildDocgenPayload(
      { entry: makeStoryIndexEntry(files['Card.stories.tsx'], 'Layout/Card') },
      {
        componentMetaManager,
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(payload).toBeDefined();
    expect(payload!.id).toBe('card');
    expect(payload!.name).toBe('Card');
    expect(payload!.subcomponents).toBeDefined();
    expect(Object.keys(payload!.subcomponents ?? {})).toEqual(['CardHeader']);
    expect(Object.keys(payload!.subcomponents?.CardHeader.reactComponentMeta?.props ?? {})).toContain(
      'level'
    );
  });
});
