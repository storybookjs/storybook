import { beforeEach, expect, test, vi } from 'vitest';

import fs from 'node:fs';

import { up } from 'empathic/find';
import { Tag } from 'storybook/internal/core-server';

import { dedent } from 'ts-dedent';

import { invalidateCompodocCache } from './compodocDocgen';
import { invalidateCache } from './utils';
import { fsMocks, indexJson, sampleCompodocJson } from './fixtures';

// Build an in-memory filesystem from the fsMocks record
// Use vi.hoisted to ensure fileSystem is available before vi.mock is executed
const { fileSystem, populateFs } = vi.hoisted(() => {
  const fileSystem: Record<string, string> = {};

  function populateFs(mocks: Record<string, string>, basePath: string) {
    Object.entries(mocks).forEach(([relativePath, content]) => {
      const fullPath = `${basePath}/${relativePath.replace(/^\.\//, '')}`;
      fileSystem[fullPath] = content;
    });
  }

  return { fileSystem, populateFs };
});

vi.mock('node:fs', { spy: true });

vi.mock('empathic/find', { spy: true });

// Dynamic import of the generator after mocks are set up
const { manifests } = await import('./generator');

beforeEach(() => {
  // Clear the in-memory filesystem
  Object.keys(fileSystem).forEach((k) => delete fileSystem[k]);
  // Populate with default mocks
  populateFs(fsMocks, '/app');
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  invalidateCache();
  invalidateCompodocCache();

  vi.mocked(fs.existsSync).mockImplementation((filePath) => (filePath as string) in fileSystem);
  vi.mocked(fs.readFileSync).mockImplementation((filePath, _encoding) => {
    if ((filePath as string) in fileSystem) {
      return fileSystem[filePath as string] as any;
    }
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  });
  vi.mocked(up).mockReturnValue('/app/package.json');
});

test('manifests generates components with correct id, name, description, and stories', async () => {
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);

  // Should have a components key
  expect(result?.components).toBeDefined();
  expect(result?.components?.meta?.docgen).toBe('compodoc');

  const components = result?.components?.components ?? {};

  // Should have Button and Header
  expect(Object.keys(components)).toContain('example-button');
  expect(Object.keys(components)).toContain('example-header');

  // Button should have correct data
  const button = components['example-button'];
  expect(button.name).toBe('ButtonComponent');
  expect(button.path).toBe('./src/stories/button.stories.ts');
  expect(button.stories).toHaveLength(4);
  expect(button.stories.map((s: any) => s.name)).toEqual([
    'Primary',
    'Secondary',
    'Large',
    'Small',
  ]);

  // Each story should have an Angular template snippet
  const primary = button.stories.find((s: any) => s.name === 'Primary');
  expect(primary?.snippet).toBeDefined();
  expect(primary?.snippet).toContain('app-button');
  expect(primary?.snippet).toContain('primary');
  expect(primary?.snippet).toContain('label');
});

test('manifests generates correct import statement', async () => {
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);
  const button = result?.components?.components?.['example-button'];

  expect(button?.import).toBeDefined();
  expect(button?.import).toContain('ButtonComponent');
});

test('manifests extracts description from CSF meta JSDoc', async () => {
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);
  const header = result?.components?.components?.['example-header'];

  expect(header?.description).toBe('Description from meta and very long.');
  expect(header?.summary).toBe('Component summary');
});

test('manifests returns empty components when no documentation.json', async () => {
  // Remove documentation.json from our FS
  delete fileSystem['/app/documentation.json'];

  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);

  expect(result?.components?.components).toEqual({});
  expect(result?.components?.meta?.docgen).toBe('compodoc');
});

test('manifests handles missing component gracefully', async () => {
  // Story file referencing a component not in Compodoc
  const brokenStory = dedent`
    import type { Meta, StoryObj } from '@storybook/angular';
    import { UnknownComponent } from './unknown.component';

    const meta: Meta<UnknownComponent> = {
      title: 'Example/Unknown',
      component: UnknownComponent,
    };
    export default meta;

    export const Default: StoryObj = {};
  `;

  fileSystem['/app/src/stories/unknown.stories.ts'] = brokenStory;

  const manifestEntries = [
    {
      type: 'story',
      subtype: 'story',
      id: 'example-unknown--default',
      name: 'Default',
      title: 'Example/Unknown',
      importPath: './src/stories/unknown.stories.ts',
      tags: [Tag.MANIFEST],
      exportName: 'Default',
    },
  ];

  const result = await manifests(undefined, { manifestEntries } as any);
  const unknown = result?.components?.components?.['example-unknown'];

  expect(unknown).toBeDefined();
  expect(unknown?.error).toBeDefined();
  expect(unknown?.error?.name).toContain('not found');
});

test('manifests skips docs entries without MANIFEST tag', async () => {
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );

  // The docs entry should be filtered out
  const docsEntry = indexJson.entries['example-header--docs'];
  expect(docsEntry.tags).not.toContain(Tag.MANIFEST);

  const result = await manifests(undefined, { manifestEntries } as any);
  const components = result?.components?.components ?? {};

  // Should not have docs entry as a separate component
  expect(Object.keys(components)).not.toContain('example-header--docs');
});

test('manifests deduplicates by component id', async () => {
  // All 4 button stories should merge under one component
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);
  const components = result?.components?.components ?? {};

  // Only 2 components (button, header), not 6 entries
  expect(Object.keys(components).length).toBe(2);
});

test('manifests merges existing manifests', async () => {
  const existingManifests = {
    someKey: { v: 0, components: {}, meta: {} },
  };
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(existingManifests as any, { manifestEntries } as any);

  // Should preserve existing key
  expect(result).toHaveProperty('someKey');
  // And add components
  expect(result).toHaveProperty('components');
});
