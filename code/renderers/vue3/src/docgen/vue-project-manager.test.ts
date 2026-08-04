import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';
import type { ComponentMetaChecker } from 'vue-component-meta';

import { buildDocgenPayload } from './build-docgen.ts';
import { VueComponentMetaManager, VueComponentMetaProject } from './vue-project-manager.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const referencesDir = join(fixturesDir, 'references');

// One manager across the suite — checker construction is the expensive part, and sharing it is
// exactly the production shape (one manager per worker lifetime).
const manager = new VueComponentMetaManager(ts);
afterAll(() => manager.dispose());

describe('VueComponentMetaManager', () => {
  // The stock `create-vue` scaffold: the root tsconfig is nothing but `references`. The previous
  // single-checker path bailed to a whole-project `include: ['**/*']` fallback here (upstream:
  // vuejs/language-tools#3896); the manager walks the reference chain instead and lands on the
  // sub-config whose `include` actually covers the component.
  it('resolves a component through a references-only root tsconfig to its sub-project', () => {
    const componentPath = join(referencesDir, 'src/RefButton.vue').replace(/\\/g, '/');
    const project = manager.getProjectForFile(componentPath);

    expect(project.configFileName).toBe(
      join(referencesDir, 'tsconfig.app.json').replace(/\\/g, '/')
    );
    // Pin the *direct-include* mechanism: the SFC must appear in the parsed fileNames, so matching
    // is by config contents — not by the slower indirect fallback that probes each candidate
    // project's built program.
    expect(project.getCommandLine().fileNames).toContain(componentPath);
  });

  it('extracts docgen end to end through the manager-resolved checker', async () => {
    const entry = {
      type: 'story',
      subtype: 'story',
      id: 'example-refbutton--default',
      name: 'Default',
      title: 'Example/RefButton',
      importPath: './src/RefButton.stories.ts',
    } as unknown as IndexEntry;

    const payload = await buildDocgenPayload(
      { entry },
      {
        getChecker: (componentPath) => manager.getCheckerForFile(componentPath),
        resolvePath: (importPath) => join(referencesDir, importPath),
      }
    );

    expect(payload?.error).toBeUndefined();
    expect(payload?.argTypes?.label).toMatchObject({
      description: 'Text shown inside the button.',
      type: { name: 'string', required: true },
    });
    // The union survives as a real enum — proof the checker compiled the SFC under a scoped
    // config rather than reporting nothing.
    expect(payload?.argTypes?.tone?.type).toEqual({
      name: 'enum',
      value: ['calm', 'loud'],
      required: false,
    });
    // And the payload still satisfies the worker transport.
    expect(() => structuredClone(payload)).not.toThrow();
  });

  // `__testfixtures__/tsconfig.json` has no `include`, so it covers everything beneath it — but
  // only if the parse lists `.vue` files in `fileNames`. A plain TS parse never would (that is why
  // the factory re-enumerates with the Vue extensions as `extraFileExtensions`), and the SFC would
  // only match through the indirect built-program fallback.
  it('matches .vue files to a tsconfig via the Vue-aware command-line parse', () => {
    const componentPath = join(fixturesDir, 'Button.vue').replace(/\\/g, '/');
    const project = manager.getProjectForFile(componentPath);

    expect(project.configFileName).toBe(join(fixturesDir, 'tsconfig.json').replace(/\\/g, '/'));
    expect(project.getCommandLine().fileNames).toContain(componentPath);
  });

  it('serves files no tsconfig covers from the inferred project', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const dir = await mkdtemp(join(tmpdir(), 'sb-vue-inferred-'));
    await writeFile(
      join(dir, 'Loose.vue'),
      '<script setup lang="ts">defineProps<{ x: number }>();</script><template><i/></template>'
    );

    const project = manager.getProjectForFile(join(dir, 'Loose.vue'));

    expect(project.configFileName).toBeUndefined();
  });

  it('defers and batches created files until the project is next queried', () => {
    const buttonPath = join(fixturesDir, 'Button.vue').replace(/\\/g, '/');
    const refButtonPath = join(referencesDir, 'src/RefButton.vue').replace(/\\/g, '/');
    const excludedPath = join(fixturesDir, 'excluded.vue').replace(/\\/g, '/');
    const checker = {
      updateFile: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as ComponentMetaChecker;
    const refreshedCommandLine = {
      options: {},
      fileNames: [buttonPath, refButtonPath],
      errors: [],
    } satisfies ts.ParsedCommandLine;
    const getCommandLine = vi.fn(() => refreshedCommandLine);
    const project = new VueComponentMetaProject(
      checker,
      { options: {}, fileNames: [], errors: [] },
      join(fixturesDir, 'tsconfig.json'),
      getCommandLine
    );

    project.onFilesChanged([
      { filePath: buttonPath, type: 'created' },
      { filePath: refButtonPath, type: 'created' },
      { filePath: excludedPath, type: 'created' },
    ]);

    expect(getCommandLine).not.toHaveBeenCalled();
    expect(checker.updateFile).not.toHaveBeenCalled();

    expect(project.getCommandLine()).toBe(refreshedCommandLine);
    expect(getCommandLine).toHaveBeenCalledOnce();
    expect(checker.updateFile).toHaveBeenCalledTimes(2);
    expect(checker.updateFile).toHaveBeenCalledWith(buttonPath, expect.any(String));
    expect(checker.updateFile).toHaveBeenCalledWith(refButtonPath, expect.any(String));
    expect(checker.updateFile).not.toHaveBeenCalledWith(excludedPath, expect.any(String));

    project.getCommandLine();
    expect(getCommandLine).toHaveBeenCalledOnce();
    expect(checker.updateFile).toHaveBeenCalledTimes(2);
  });
});
