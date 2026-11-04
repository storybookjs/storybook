import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

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

describe('generateProjectAnnotationsCodeFromPreviews with a module importer', () => {
  it('loads a CSF Next preview file through the importModule function of the importer', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    const code = generateProjectAnnotationsCodeFromPreviews({
      ...options,
      isCsf4: true,
      moduleImporter: '/project/importer.js',
    });

    expect(code).toMatchInlineSnapshot(`
      "import { importModule } from "/project/importer.js";
      import * as preview_2178760794 from "/project/.storybook/preview.ts";

      export async function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = await importModule("./.storybook/preview.ts", async () => hmrPreviewAnnotationModules[0] ?? preview_2178760794);
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
        moduleImporter: '/project/importer.js',
      })
    ).toMatchInlineSnapshot(`
      "import { composeConfigs } from 'storybook/preview-api';
      import { importModule } from "/project/importer.js";

      import * as preview_3900539004 from "/project/addon/preview.js";
      import * as preview_2178760794 from "/project/.storybook/preview.ts";

      export async function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const configs = [
          hmrPreviewAnnotationModules[0] ?? preview_3900539004,
          await importModule("./.storybook/preview.ts", async () => hmrPreviewAnnotationModules[1] ?? preview_2178760794)
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
      moduleImporter: '/project/importer.js',
    });

    expect(code).not.toContain('await importModule(');
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
        moduleImporter: join(dir, 'importer.js'),
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
});
