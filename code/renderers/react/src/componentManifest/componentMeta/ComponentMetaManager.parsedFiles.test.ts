import * as fs from 'node:fs';
import * as path from 'node:path';

import { once } from 'storybook/internal/node-logger';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import type { StoryRef } from '../getComponentImports.ts';
import { ComponentMetaManager } from './ComponentMetaManager.ts';
import { cleanup, createTempDir, tsconfigJSON, writeFiles } from './test-helpers.ts';
import { DOCGEN_TS_API, loadTestTypeScript } from '@storybook/component-meta-typescript/testing';

const typescript = await loadTestTypeScript();

describe('parsed files shared between projects', () => {
  let tempDir: string | undefined;
  let manager: ComponentMetaManager;

  afterEach(() => {
    vi.restoreAllMocks();
    manager?.dispose();
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it(
    'reads a shared file that changed after another project parsed it',
    { timeout: 30_000 },
    () => {
      tempDir = createTempDir();
      const component = (name: string) => dedent`
      import React from 'react';
      import type { Props } from '../shared.ts';
      export const ${name} = (_props: Props) => <div />;
    `;
      const files = writeFiles(tempDir, {
        'shared.ts': `export interface Props { label: string }`,
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': component('Button'),
        'app/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': component('Card'),
        'lib/Card.stories.tsx': `import { Card } from './Card';\nexport default {};`,
      });
      const toRef = (dir: string, name: string): StoryRef => ({
        storyPath: files[`${dir}/${name}.stories.tsx`],
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: files[`${dir}/${name}.tsx`],
          isPackage: false,
        },
      });
      manager = new ComponentMetaManager(typescript);
      manager.batchExtract([toRef('app', 'Button')]);
      fs.writeFileSync(
        files['shared.ts'],
        `export interface Props { label: string; size: number }`
      );
      const later = new Date(Date.now() + 10_000);
      fs.utimesSync(files['shared.ts'], later, later);

      const card = toRef('lib', 'Card');
      manager.batchExtract([card]);

      expect(Object.keys(card.component?.reactComponentMeta?.props ?? {})).toEqual(
        expect.arrayContaining(['label', 'size'])
      );
    }
  );

  describe('heap-pressure recycle', () => {
    const setup = ({ keepParsedFilesOnRecycle = true } = {}) => {
      tempDir = createTempDir();
      const source = (name: string) =>
        `import React from 'react';\nexport const ${name} = (_props: { label: string }) => <div />;`;
      const files = writeFiles(tempDir, {
        'app/tsconfig.json': tsconfigJSON(),
        'app/Button.tsx': source('Button'),
        'app/Button.stories.tsx': `import { Button } from './Button';\nexport default {};`,
        'lib/tsconfig.json': tsconfigJSON(),
        'lib/Card.tsx': source('Card'),
        'lib/Card.stories.tsx': `import { Card } from './Card';\nexport default {};`,
      });
      manager = new ComponentMetaManager(typescript, undefined, { keepParsedFilesOnRecycle });
      const toRef = (dir: string, name: string) => ({
        storyPath: files[`${dir}/${name}.stories.tsx`],
        component: {
          componentName: name,
          importId: `./${name}`,
          importName: name,
          path: files[`${dir}/${name}.tsx`],
          isPackage: false,
        },
      });
      vi.spyOn(once, 'warn').mockImplementation(() => undefined);
      return { button: toRef('app', 'Button'), card: toRef('lib', 'Card') };
    };

    const extractUnderHeapPressure = (entries: StoryRef[]) => {
      vi.spyOn(process, 'memoryUsage').mockReturnValueOnce({
        heapUsed: Number.POSITIVE_INFINITY,
      } as NodeJS.MemoryUsage);
      manager.batchExtract(entries);
    };

    it.skipIf(DOCGEN_TS_API === 'native')(
      'keeps the parsed files of the project the batch used',
      { timeout: 30_000 },
      () => {
        const { button } = setup();
        manager.batchExtract([button]);
        const project = manager.getProjectForFile(button.storyPath);
        const parsed = project.getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(button.storyPath);
        expect(rebuilt).not.toBe(project);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(button.component.path)).toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'keeps the parsed files across two recycles in a row',
      { timeout: 30_000 },
      () => {
        const { button } = setup();
        manager.batchExtract([button]);
        const parsed = manager
          .getProjectForFile(button.storyPath)
          .getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);
        const afterFirst = manager.getProjectForFile(button.storyPath);
        extractUnderHeapPressure([button]);

        const afterSecond = manager.getProjectForFile(button.storyPath);
        expect(afterSecond).not.toBe(afterFirst);
        expect(parsed).toBeDefined();
        expect(afterSecond.getSourceFile(button.component.path)).toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'parses the files of a project the batch did not use again',
      { timeout: 30_000 },
      () => {
        const { button, card } = setup();
        manager.batchExtract([card]);
        const parsed = manager.getProjectForFile(card.storyPath).getSourceFile(card.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(card.storyPath);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(card.component.path)).not.toBe(parsed);
      }
    );

    it.skipIf(DOCGEN_TS_API === 'native')(
      'parses the files again unless the manager keeps them',
      { timeout: 30_000 },
      () => {
        const { button } = setup({ keepParsedFilesOnRecycle: false });
        manager.batchExtract([button]);
        const parsed = manager
          .getProjectForFile(button.storyPath)
          .getSourceFile(button.component.path);

        extractUnderHeapPressure([button]);

        const rebuilt = manager.getProjectForFile(button.storyPath);
        expect(parsed).toBeDefined();
        expect(rebuilt.getSourceFile(button.component.path)).not.toBe(parsed);
      }
    );

    it('reads a file that changed since the recycled project read it', { timeout: 30_000 }, () => {
      const { button } = setup();
      const propsFile = path.join(path.dirname(button.component.path), 'props.ts');
      fs.writeFileSync(propsFile, `export interface Props { label: string }`);
      fs.writeFileSync(
        button.component.path,
        `import React from 'react';\nimport type { Props } from './props';\nexport const Button = (_props: Props) => <div />;`
      );
      manager.batchExtract([button]);
      fs.writeFileSync(propsFile, `export interface Props { label: string; size: number }`);
      const later = new Date(Date.now() + 10_000);
      fs.utimesSync(propsFile, later, later);

      extractUnderHeapPressure([button]);
      manager.batchExtract([button]);

      const extracted: StoryRef = button;
      expect(Object.keys(extracted.component?.reactComponentMeta?.props ?? {})).toEqual(
        expect.arrayContaining(['label', 'size'])
      );
    });

    it('extracts the same props from the project it rebuilt', { timeout: 30_000 }, () => {
      const { button } = setup();
      manager.batchExtract([button]);
      const before = structuredClone(button.component);

      extractUnderHeapPressure([button]);
      manager.batchExtract([button]);

      expect(button.component).toEqual(before);
      expect(button.component).toMatchObject({ reactComponentMeta: { displayName: 'Button' } });
    });
  });
});
