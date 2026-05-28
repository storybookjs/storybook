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
let manager: ComponentMetaManager | undefined;

afterEach(() => {
  manager?.dispose();
  manager = undefined;
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

function makeStoryEntry(id: string, importPath: string, title = 'Comp'): IndexEntry {
  return {
    id,
    name: id.split('--').slice(1).join('--') || 'Default',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

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
      const storyEntry = makeStoryEntry(
        'forms-button--primary',
        files['Button.stories.tsx'],
        'Forms/Button'
      );

      const payload = await buildDocgenPayload(
        { componentId: 'forms-button', entries: [storyEntry] },
        {
          manager,
          resolvePath: (importPath) =>
            path.isAbsolute(importPath) ? importPath : path.join(tempDir!, importPath),
        }
      );

      expect(payload.componentId).toBe('forms-button');
      expect(payload.name).toBe('Button');
      expect(payload.description).toContain('clickable button');
      expect(payload.props.map((p) => p.name).sort()).toEqual(['disabled', 'label']);
      const labelProp = payload.props.find((p) => p.name === 'label');
      expect(labelProp?.required).toBe(true);
      expect(payload.stories).toHaveLength(1);
      expect(payload.stories?.[0]).toMatchObject({
        id: 'forms-button--primary',
        name: 'Primary',
      });
      expect(payload.stories?.[0].snippet).toMatch(/<Button label="hi"/);
    }
  );

  it(
    'returns shape-complete payload with error field when story file is missing',
    { timeout: 15_000 },
    async () => {
      tempDir = createTempDir('docgen-build');
      manager = new ComponentMetaManager(ts);

      const entry = makeStoryEntry('missing--default', 'does-not-exist.stories.tsx', 'Missing');

      const payload = await buildDocgenPayload(
        { componentId: 'missing', entries: [entry] },
        {
          manager,
          resolvePath: (importPath) => path.join(tempDir!, importPath),
        }
      );

      expect(payload.componentId).toBe('missing');
      expect(payload.props).toEqual([]);
      expect(payload.error).toBeDefined();
      expect(payload.error?.message).toMatch(/does-not-exist/);
    }
  );

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
    const entry = makeStoryEntry('layout-card--default', files['Card.stories.tsx'], 'Layout/Card');

    const payload = await buildDocgenPayload(
      { componentId: 'layout-card', entries: [entry] },
      {
        manager,
        resolvePath: (importPath) =>
          path.isAbsolute(importPath) ? importPath : path.join(tempDir!, importPath),
      }
    );

    expect(payload.name).toBe('Card');
    expect(payload.subcomponents).toBeDefined();
    expect(Object.keys(payload.subcomponents ?? {})).toEqual(['CardHeader']);
    expect(payload.subcomponents?.CardHeader.props.map((p) => p.name)).toContain('level');
  });
});
