import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { join } from 'pathe';
import { dedent } from 'ts-dedent';

import { generateProjectAnnotationsCodeFromPreviews } from './codegen-project-annotations.ts';

const options = {
  previewAnnotations: ['/project/addon/preview.js'],
  previewFile: '/project/.storybook/preview.ts',
  projectRoot: '/project',
  frameworkName: 'frameworkName',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateProjectAnnotationsCodeFromPreviews', () => {
  it('imports a CSF Next preview file as it is without a module importer', () => {
    expect(generateProjectAnnotationsCodeFromPreviews({ ...options, isCsf4: true }))
      .toMatchInlineSnapshot(`
      "import * as preview_2178760794 from "/project/.storybook/preview.ts";

      export function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = hmrPreviewAnnotationModules[0] ?? preview_2178760794;
        return preview.default.composed;
      }

      if (import.meta.hot) {
        import.meta.hot.accept(["/project/.storybook/preview.ts"], (previewAnnotationModules) => {
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }"
    `);
  });

  it('imports a CSF 3 preview file as it is without a module importer', () => {
    expect(generateProjectAnnotationsCodeFromPreviews({ ...options, isCsf4: false }))
      .toMatchInlineSnapshot(`
      "import { composeConfigs } from 'storybook/preview-api';

      import * as preview_3900539004 from "/project/addon/preview.js";
      import * as preview_2178760794 from "/project/.storybook/preview.ts";

      export function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const configs = [
          hmrPreviewAnnotationModules[0] ?? preview_3900539004,
          hmrPreviewAnnotationModules[1] ?? preview_2178760794
        ];
        return composeConfigs(configs);
      }

      if (import.meta.hot) {
        import.meta.hot.accept(["/project/addon/preview.js","/project/.storybook/preview.ts"], (previewAnnotationModules) => {
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }"
    `);
  });
});

describe('generateProjectAnnotationsCodeFromPreviews with module importers', () => {
  it('loads a CSF Next preview file through the importModule function of the importer', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    const code = generateProjectAnnotationsCodeFromPreviews({
      ...options,
      isCsf4: true,
      moduleImporters: ['/project/importer.js'],
    });

    expect(code).toMatchInlineSnapshot(`
      "import * as preview_2178760794 from "/project/.storybook/preview.ts";

      import * as moduleImporter_0 from "/project/importer.js";

      function importModuleOf(moduleImporter, specifier) {
        if (typeof moduleImporter.importModule !== 'function') {
          throw new Error(\`The module importer \${specifier} does not export an importModule function\`);
        }
        return moduleImporter.importModule;
      }

      export async function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = await importModuleOf(moduleImporter_0, "/project/importer.js")("./.storybook/preview.ts", async (path) => path === "./.storybook/preview.ts" ? hmrPreviewAnnotationModules[0] ?? preview_2178760794 : Promise.reject(new Error(\`The preview file's importFn can't import \${path}\`)));
        return preview.default.composed;
      }

      if (import.meta.hot) {
        import.meta.hot.accept(["/project/.storybook/preview.ts"], (previewAnnotationModules) => {
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }"
    `);
  });

  it('loads a CSF 3 preview file through the importer, and no other preview annotation', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    expect(
      generateProjectAnnotationsCodeFromPreviews({
        ...options,
        isCsf4: false,
        moduleImporters: ['/project/importer.js'],
      })
    ).toMatchInlineSnapshot(`
      "import { composeConfigs } from 'storybook/preview-api';

      import * as preview_3900539004 from "/project/addon/preview.js";
      import * as preview_2178760794 from "/project/.storybook/preview.ts";

      import * as moduleImporter_0 from "/project/importer.js";

      function importModuleOf(moduleImporter, specifier) {
        if (typeof moduleImporter.importModule !== 'function') {
          throw new Error(\`The module importer \${specifier} does not export an importModule function\`);
        }
        return moduleImporter.importModule;
      }

      export async function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const configs = [
          hmrPreviewAnnotationModules[0] ?? preview_3900539004,
          await importModuleOf(moduleImporter_0, "/project/importer.js")("./.storybook/preview.ts", async (path) => path === "./.storybook/preview.ts" ? hmrPreviewAnnotationModules[1] ?? preview_2178760794 : Promise.reject(new Error(\`The preview file's importFn can't import \${path}\`)))
        ];
        return composeConfigs(configs);
      }

      if (import.meta.hot) {
        import.meta.hot.accept(["/project/addon/preview.js","/project/.storybook/preview.ts"], (previewAnnotationModules) => {
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }"
    `);
  });

  it('loads no other preview annotation through the importer when the project has no preview file', () => {
    const code = generateProjectAnnotationsCodeFromPreviews({
      ...options,
      previewFile: undefined,
      isCsf4: false,
      moduleImporters: ['/project/importer.js'],
    });

    expect(code).not.toContain('importModule_0');
    expect(code).toContain('export function getProjectAnnotations(');
  });

  it('getProjectAnnotations reads the module importModule returns, also for an HMR module', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(join(dir, 'preview.js'), 'export default { composed: { from: "file" } };');
    await writeFile(
      join(dir, 'importer.js'),
      dedent`
        export async function importModule(importPath, importFn) {
          const preview = await importFn(importPath);
          return { default: { composed: { ...preview.default.composed, importPath } } };
        }
      `
    );
    await writeFile(
      join(dir, 'project-annotations.js'),
      generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: [],
        previewFile: join(dir, 'preview.js'),
        projectRoot: dir,
        frameworkName: 'frameworkName',
        isCsf4: true,
        moduleImporters: [join(dir, 'importer.js')],
      })
    );

    const { getProjectAnnotations } = await import(
      /* @vite-ignore */ join(dir, 'project-annotations.js')
    );
    const hmrModule = { default: { composed: { from: 'hmr' } } };

    expect(await getProjectAnnotations()).toEqual({
      from: 'file',
      importPath: './preview.js',
    });
    expect(await getProjectAnnotations([hmrModule])).toEqual({
      from: 'hmr',
      importPath: './preview.js',
    });
  });

  it('imports the preview file through the chain, the last importer first', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(join(dir, 'preview.js'), 'export default { composed: { order: ["file"] } };');
    const importer = (name: string) => dedent`
      export async function importModule(importPath, importFn) {
        const preview = await importFn(importPath);
        const order = [...preview.default.composed.order, '${name}'];
        return { default: { composed: { order } } };
      }
    `;
    await writeFile(join(dir, 'framework.js'), importer('framework'));
    await writeFile(join(dir, 'project.js'), importer('project'));
    await writeFile(
      join(dir, 'project-annotations.js'),
      generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: [],
        previewFile: join(dir, 'preview.js'),
        projectRoot: dir,
        frameworkName: 'frameworkName',
        isCsf4: true,
        moduleImporters: [join(dir, 'framework.js'), join(dir, 'project.js')],
      })
    );

    const { getProjectAnnotations } = await import(
      /* @vite-ignore */ join(dir, 'project-annotations.js')
    );

    // The project's importer is asked first, so it sees what the framework's made of the file
    expect(await getProjectAnnotations()).toEqual({ order: ['file', 'framework', 'project'] });
  });

  it("rejects a path other than the preview file in the preview file's importFn", async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(join(dir, 'preview.js'), 'export default { composed: {} };');
    await writeFile(
      join(dir, 'importer.js'),
      'export function importModule(path, importFn) { return importFn("./elsewhere.js"); }'
    );
    await writeFile(
      join(dir, 'project-annotations.js'),
      generateProjectAnnotationsCodeFromPreviews({
        previewAnnotations: [],
        previewFile: join(dir, 'preview.js'),
        projectRoot: dir,
        frameworkName: 'frameworkName',
        isCsf4: true,
        moduleImporters: [join(dir, 'importer.js')],
      })
    );

    const { getProjectAnnotations } = await import(
      /* @vite-ignore */ join(dir, 'project-annotations.js')
    );

    await expect(getProjectAnnotations()).rejects.toThrow(
      "The preview file's importFn can't import ./elsewhere.js"
    );
  });

  it('skips an undefined preview annotation of a preset', () => {
    const code = generateProjectAnnotationsCodeFromPreviews({
      ...options,
      previewAnnotations: ['/project/addon/preview.js', undefined],
      isCsf4: false,
    });

    expect(code).toBe(generateProjectAnnotationsCodeFromPreviews({ ...options, isCsf4: false }));
  });
});
