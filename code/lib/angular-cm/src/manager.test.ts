import { cp, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { AngularComponentMetaManager } from './manager.ts';
import type { AngularComponentMetaResult } from './types.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__', 'manager');
const normalize = (fileName: string) => fileName.replace(/\\/g, '/');
const togglePath = normalize(join(fixturesDir, 'toggle.component.ts'));

// One manager for the whole suite: building programs is expensive, and it matches production.
const manager = new AngularComponentMetaManager(ts);

const scratchDirs: string[] = [];
afterAll(async () => {
  // Dispose first so the LanguageService no longer holds the scratch files.
  manager.dispose();
  await Promise.all(scratchDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function inputsOf(result: AngularComponentMetaResult | undefined) {
  const entry = result?.entry;
  if (!entry || (entry.type !== 'component' && entry.type !== 'directive')) {
    throw new Error(`Expected a component or directive entry, got ${entry?.type}`);
  }
  return entry.inputsClass;
}

// The explicit mtime bump makes the edit unambiguous to the mtime-keyed snapshot cache even when
// the write lands within the same millisecond as the previous read.
async function editFile(filePath: string, search: string, replacement: string) {
  const text = await readFile(filePath, 'utf8');
  if (!text.includes(search)) {
    throw new Error(`Fixture drift: "${search}" not found in ${filePath}`);
  }
  await writeFile(filePath, text.replace(search, replacement));
  const future = new Date(Date.now() + 5000);
  await utimes(filePath, future, future);
}

// Copies into a scratch dir so edits never touch the committed fixture.
async function makeScratchCopy(prefix: string) {
  const scratch = await mkdtemp(join(tmpdir(), prefix));
  scratchDirs.push(scratch);
  const projectDir = join(scratch, 'app');
  await cp(fixturesDir, projectDir, { recursive: true });
  return normalize(join(projectDir, 'toggle.component.ts'));
}

describe('AngularComponentMetaManager', () => {
  it('resolves a component to its covering tsconfig project', () => {
    const project = manager.getProjectForFile(togglePath);

    expect(project.configFileName).toBe(normalize(join(fixturesDir, 'tsconfig.json')));
    expect(project.getCommandLine().fileNames).toContain(togglePath);
  });

  it('resolves files under a nested tsconfig to their own project', () => {
    const nestedPath = normalize(join(fixturesDir, 'nested', 'nested-badge.component.ts'));
    const nestedProject = manager.getProjectForFile(nestedPath);
    const rootProject = manager.getProjectForFile(togglePath);

    expect(nestedProject.configFileName).toBe(
      normalize(join(fixturesDir, 'nested', 'tsconfig.json'))
    );
    expect(nestedProject).not.toBe(rootProject);
    expect(rootProject.getCommandLine().fileNames).not.toContain(nestedPath);

    const result = manager.extractComponentMeta(nestedPath, { exportName: 'NestedBadgeComponent' });
    expect(result?.entry.name).toBe('NestedBadgeComponent');
  });

  it('extracts decorator inputs, signal inputs, and cross-file inherited inputs', () => {
    const result = manager.extractComponentMeta(togglePath, { exportName: 'ToggleComponent' });

    expect(result?.entry.name).toBe('ToggleComponent');
    expect(result?.entry.file).toBe(togglePath);

    const inputs = inputsOf(result);
    const names = inputs.map((input) => input.name);
    expect(names).toContain('label'); // @Input() on the component itself
    expect(names).toContain('size'); // signal input()
    expect(names).toContain('disabled'); // @Input() inherited from ./base-toggle.ts

    const label = inputs.find((input) => input.name === 'label');
    expect(label?.initializer?.text).toContain('Toggle');
  });

  it('exposes program source files (component and base) for directory watching', () => {
    manager.extractComponentMeta(togglePath, { exportName: 'ToggleComponent' });

    const paths = manager.getProjectForFile(togglePath).getSourceFilePaths();
    expect(paths).toContain(togglePath);
    expect(paths).toContain(normalize(join(fixturesDir, 'base-toggle.ts')));
  });

  it('picks the default-exported class when exportName is "default"', () => {
    const filePath = normalize(join(fixturesDir, 'default-export.component.ts'));
    const result = manager.extractComponentMeta(filePath, { exportName: 'default' });

    expect(result?.entry.name).toBe('DefaultCardComponent');
  });

  it('resolves `export { X as default }` through the module exports', () => {
    const filePath = normalize(join(fixturesDir, 'aliased-default.component.ts'));
    const result = manager.extractComponentMeta(filePath, { exportName: 'default' });

    expect(result?.entry.name).toBe('AliasedCardComponent');
    expect(inputsOf(result).map((input) => input.name)).toContain('note');
  });

  it('attaches TypeScript JSDoc info for default-exported components', () => {
    const namedDefault = manager.extractComponentMeta(
      normalize(join(fixturesDir, 'default-export.component.ts')),
      { exportName: 'default' }
    );
    const aliasedDefault = manager.extractComponentMeta(
      normalize(join(fixturesDir, 'aliased-default.component.ts')),
      { exportName: 'default' }
    );

    expect(namedDefault?.jsDocInfo).toMatchInlineSnapshot(`
      {
        "description": "Default export docs.",
        "jsDocTags": {
          "summary": [
            "Named default summary.",
          ],
        },
      }
    `);
    expect(aliasedDefault?.jsDocInfo).toMatchInlineSnapshot(`
      {
        "description": "Aliased default docs.",
        "jsDocTags": {
          "summary": [
            "Aliased default summary.",
          ],
        },
      }
    `);
  });

  it('resolves a component behind a star barrel to its defining file', () => {
    const barrelPath = normalize(join(fixturesDir, 'barrel-star.ts'));
    const result = manager.extractComponentMeta(barrelPath, { exportName: 'ToggleComponent' });

    expect(result?.entry.name).toBe('ToggleComponent');
    expect(result?.entry.file).toBe(togglePath);
    expect(inputsOf(result).map((input) => input.name)).toContain('label');
  });

  it('resolves an aliased named re-export through a barrel', () => {
    const barrelPath = normalize(join(fixturesDir, 'barrel-named.ts'));
    const result = manager.extractComponentMeta(barrelPath, { exportName: 'PublicToggle' });

    expect(result?.entry.name).toBe('ToggleComponent');
    expect(result?.entry.file).toBe(togglePath);
  });

  it('falls back to localName when the export name matches no class', () => {
    const renamed = manager.extractComponentMeta(togglePath, {
      exportName: 'PublicToggle',
      localName: 'ToggleComponent',
    });
    expect(renamed?.entry.name).toBe('ToggleComponent');

    expect(manager.extractComponentMeta(togglePath, { exportName: 'Missing' })).toBeUndefined();
  });

  it('serves files no tsconfig covers from the inferred project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sb-acm-inferred-'));
    scratchDirs.push(dir);
    const loosePath = normalize(join(dir, 'loose.component.ts'));
    await writeFile(
      loosePath,
      [
        "import { Component, Input } from '@angular/core';",
        '',
        "@Component({ selector: 'sb-loose', template: '<i></i>' })",
        'export class LooseComponent {',
        '  @Input() amount = 0;',
        '}',
        '',
      ].join('\n')
    );

    const project = manager.getProjectForFile(loosePath);
    expect(project.configFileName).toBeUndefined();

    const result = manager.extractComponentMeta(loosePath, { exportName: 'LooseComponent' });
    expect(inputsOf(result).map((input) => input.name)).toContain('amount');
  });

  it('re-extracts an edited component after onFilesChanged', async () => {
    const componentPath = await makeScratchCopy('sb-acm-watch-');

    const before = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(before).map((input) => input.name)).toContain('label');

    await editFile(componentPath, '@Input() label', '@Input() headline');
    manager.onFilesChanged([{ filePath: componentPath, type: 'changed' }]);

    const after = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    const names = inputsOf(after).map((input) => input.name);
    expect(names).toContain('headline');
    expect(names).not.toContain('label');
  });

  it('re-extracts a rewrite whose mtime is unchanged after onFilesChanged', async () => {
    const componentPath = await makeScratchCopy('sb-acm-mtime-');

    // The mtime is pinned to a whole second so both writes land on the identical timestamp,
    // reproducing a second write within one mtime tick on a coarse-mtime filesystem.
    const pinned = new Date(Math.floor(Date.now() / 1000) * 1000);
    await utimes(componentPath, pinned, pinned);

    const before = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(before).map((input) => input.name)).toContain('label');

    const text = await readFile(componentPath, 'utf8');
    await writeFile(componentPath, text.replace('@Input() label', '@Input() headline'));
    await utimes(componentPath, pinned, pinned);
    expect((await stat(componentPath)).mtime.valueOf()).toBe(pinned.valueOf());

    manager.onFilesChanged([{ filePath: componentPath, type: 'changed' }]);

    const after = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    const names = inputsOf(after).map((input) => input.name);
    expect(names).toContain('headline');
    expect(names).not.toContain('label');
  });

  it('re-extracts inherited members after a base-class edit', async () => {
    const componentPath = await makeScratchCopy('sb-acm-base-');
    const basePath = normalize(join(dirname(componentPath), 'base-toggle.ts'));

    const before = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(before).map((input) => input.name)).toContain('disabled');

    await editFile(basePath, '@Input() disabled', '@Input() muted');
    manager.onFilesChanged([{ filePath: basePath, type: 'changed' }]);

    const after = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    const names = inputsOf(after).map((input) => input.name);
    expect(names).toContain('muted');
    expect(names).not.toContain('disabled');
  });

  it('picks up a created file through the root-set reparse', async () => {
    const componentPath = await makeScratchCopy('sb-acm-created-');
    // Build the project first so the created file is genuinely new to its program.
    manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });

    const project = manager.getProjectForFile(componentPath);
    const extraPath = normalize(join(dirname(componentPath), 'extra.component.ts'));
    expect(project.getSourceFilePaths()).not.toContain(extraPath);

    await writeFile(
      extraPath,
      [
        "import { Component, Input } from '@angular/core';",
        '',
        "@Component({ selector: 'sb-extra', template: '' })",
        'export class ExtraComponent {',
        "  @Input() extra = 'yes';",
        '}',
        '',
      ].join('\n')
    );
    manager.onFilesChanged([{ filePath: extraPath, type: 'created' }]);

    expect(project.getSourceFilePaths()).toContain(extraPath);
    const result = manager.extractComponentMeta(extraPath, { exportName: 'ExtraComponent' });
    expect(inputsOf(result).map((input) => input.name)).toContain('extra');
  });

  it('picks up an on-disk change through ensureFresh without a change event', async () => {
    const componentPath = await makeScratchCopy('sb-acm-fresh-');

    const before = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(before).find((input) => input.name === 'label')?.initializer?.text).toContain(
      'Toggle'
    );

    await editFile(componentPath, "label = 'Toggle'", "label = 'Switched'");

    const after = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(after).find((input) => input.name === 'label')?.initializer?.text).toContain(
      'Switched'
    );
  });

  it('picks up a base-class edit through the freshness sweep without a change event', async () => {
    const componentPath = await makeScratchCopy('sb-acm-fresh-base-');
    const basePath = normalize(join(dirname(componentPath), 'base-toggle.ts'));

    const before = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    expect(inputsOf(before).map((input) => input.name)).toContain('disabled');

    await editFile(basePath, '@Input() disabled', '@Input() muted');

    const after = manager.extractComponentMeta(componentPath, { exportName: 'ToggleComponent' });
    const names = inputsOf(after).map((input) => input.name);
    expect(names).toContain('muted');
    expect(names).not.toContain('disabled');
  });
});
