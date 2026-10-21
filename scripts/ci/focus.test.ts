import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { allTemplates, normal } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import {
  FOCUS_PATH_ROOTS,
  PATH_TRIGGERED_JOBS,
  getFocusJobs,
  selectChromaticSiblings,
  selectFocusSandbox,
  selectPathTriggeredJobs,
} from './focus.ts';

const ROOT = join(import.meta.dirname, '../..');

const packageDirsByName = new Map(
  FOCUS_PATH_ROOTS.flatMap((root) =>
    readdirSync(join(ROOT, root))
      .filter((dir) => existsSync(join(ROOT, root, dir, 'package.json')))
      .map((dir) => {
        const { name } = JSON.parse(readFileSync(join(ROOT, root, dir, 'package.json'), 'utf8'));
        return [name as string, `${root}${dir}/`] as const;
      })
  )
);

const allFocusPaths = Object.values(allTemplates).flatMap(({ focusPaths = [] }) => focusPaths);

describe('focusPaths', () => {
  it.each(
    [
      ...new Set(
        normal.flatMap((key) =>
          Object.values(allTemplates[key].expected).flatMap(
            (name) => packageDirsByName.get(name) ?? []
          )
        )
      ),
    ].sort()
  )('%s, used by a ci:normal sandbox, selects a focus sandbox', (dir) => {
    expect(allFocusPaths).toContain(dir);
  });

  it.each(allFocusPaths)(
    '%s is an existing directory under a framework, renderer, or builder root',
    (path) => {
      expect(FOCUS_PATH_ROOTS.some((root) => path.startsWith(root))).toBe(true);
      expect(path.endsWith('/')).toBe(true);
      expect(existsSync(join(import.meta.dirname, '../..', path))).toBe(true);
    }
  );
});

describe('selectFocusSandbox', () => {
  it.each([
    ['code/frameworks/angular-vite/src/preset.ts', 'angular-vite/default-ts'],
    ['code/frameworks/angular/src/server/index.ts', 'angular-cli/default-ts'],
    ['code/frameworks/nextjs-vite/src/preset.ts', 'nextjs-vite/default-ts'],
    ['code/frameworks/nextjs/src/preset.ts', 'nextjs/default-ts'],
    ['code/frameworks/react-webpack5/src/preset.ts', 'react-webpack/18-ts'],
    ['code/frameworks/vue3-vite/src/preset.ts', 'vue3-vite/default-ts'],
    ['code/frameworks/svelte-vite/src/preset.ts', 'svelte-vite/default-ts'],
    ['code/frameworks/sveltekit/src/preset.ts', 'svelte-kit/skeleton-ts'],
    ['code/frameworks/tanstack-react/src/preset.ts', 'tanstack-react-router/default-ts'],
    ['code/frameworks/preact-vite/src/preset.ts', 'preact-vite/default-ts'],
    ['code/frameworks/html-vite/src/preset.ts', 'html-vite/default-ts'],
    ['code/frameworks/web-components-vite/src/preset.ts', 'lit-vite/default-ts'],
    ['code/frameworks/react-native-web-vite/src/preset.ts', 'react-native-web-vite/expo-ts'],
    ['code/frameworks/react-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/renderers/vue3/src/render.ts', 'vue3-vite/default-ts'],
    ['code/renderers/svelte/src/render.ts', 'svelte-vite/default-ts'],
    ['code/renderers/preact/src/render.ts', 'preact-vite/default-ts'],
    ['code/renderers/html/src/render.ts', 'html-vite/default-ts'],
    ['code/renderers/web-components/src/render.ts', 'lit-vite/default-ts'],
    ['code/renderers/react/src/render.ts', 'react-vite/default-ts'],
    ['code/builders/builder-webpack5/src/index.ts', 'react-webpack/18-ts'],
    ['code/builders/builder-vite/src/index.ts', 'react-vite/default-ts'],
  ])('maps %s to %s', (changedFile, expectedSandbox) => {
    expect(selectFocusSandbox([changedFile])).toBe(expectedSandbox);
  });

  it('prefers a framework match over a shared builder match', () => {
    expect(
      selectFocusSandbox([
        'code/builders/builder-vite/src/index.ts',
        'code/frameworks/angular-vite/src/preset.ts',
      ])
    ).toBe('angular-vite/default-ts');
  });

  it('uses the React Vite sandbox when no renderer, builder, or framework changed', () => {
    expect(selectFocusSandbox(['docs/get-started/introduction.mdx'])).toBe('react-vite/default-ts');
  });
});

describe('selectChromaticSiblings', () => {
  it.each([
    ['core', 'code/core/src/manager/App.tsx'],
    ['a builder', 'code/builders/builder-vite/src/index.ts'],
    ['the React Vite framework', 'code/frameworks/react-vite/src/preset.ts'],
  ])('selects nothing when only %s changed', (_, changedFile) => {
    expect(selectChromaticSiblings('react-vite/default-ts', [changedFile])).toEqual([]);
  });

  it('selects the renderer siblings when a framework change picked the focused sandbox', () => {
    const siblings = selectChromaticSiblings('nextjs/default-ts', [
      'code/frameworks/nextjs/src/preset.ts',
      'code/renderers/react/src/render.ts',
    ]);

    expect(siblings).toContain('react-vite/default-ts');
    expect(siblings).not.toContain('nextjs/default-ts');
  });

  it('selects templates with the changed renderer under a different framework', () => {
    expect(
      selectChromaticSiblings('svelte-vite/default-ts', ['code/renderers/svelte/src/render.ts'])
    ).toEqual(['svelte-kit/skeleton-ts']);
  });
});

describe('getFocusJobs', () => {
  const jobIds = (changedFiles: string[]) => getFocusJobs(changedFiles).map(({ id }) => id);

  it('runs the build, affected checks, and every React Vite sandbox job for a core change', () => {
    expect(jobIds(['code/core/src/core-server/build-dev.ts'])).toEqual([
      'build--linux',
      'typescript-validation--affected',
      'tests--linux--affected',
      'lint-and-format--affected',
      'sandboxes',
      'react-latest--vite---typescript---create',
      'react-latest--vite---typescript---dev',
      'react-latest--vite---typescript---chromatic',
      'react-latest--vite---typescript---vitest',
      'react-latest--vite---typescript---e2e',
    ]);
  });

  it('runs the full unit suite instead of the affected tests when a global input changed', () => {
    const ids = jobIds(['code/core/src/manager/App.tsx', 'yarn.lock']);

    expect(ids).toContain('tests--linux');
    expect(ids).not.toContain('tests--linux--affected');
  });

  it('adds only the create and Chromatic jobs of each sibling', () => {
    const ids = jobIds(['code/renderers/svelte/src/render.ts']);

    expect(ids).toEqual(
      expect.arrayContaining([
        'sveltekit-latest--vite---typescript---create',
        'sveltekit-latest--vite---typescript---chromatic',
      ])
    );
    expect(ids.filter((id) => id.startsWith('sveltekit-'))).toHaveLength(2);
  });

  it('leaves out siblings that skip Chromatic', () => {
    const ids = jobIds(['code/renderers/react/src/render.ts']);

    expect(ids).toContain('next-js-latest--webpack---typescript---chromatic');
    expect(ids.some((id) => id.startsWith('bench--react-vite-default-ts--no-docs'))).toBe(false);
  });

  it('bakes the changed files into the affected typecheck and unit tests', () => {
    const changedFiles = ['code/core/src/manager/App.tsx', 'docs/index.mdx'];
    const affectedJobs = getFocusJobs(changedFiles).filter(({ id }) =>
      ['typescript-validation--affected', 'tests--linux--affected'].includes(id)
    );

    expect(affectedJobs).toHaveLength(2);
    for (const job of affectedJobs) {
      expect(job.implementation('focus')).toMatchObject({
        steps: expect.arrayContaining([
          {
            run: expect.objectContaining({
              environment: { CHANGED_FILES: changedFiles.join('\n') },
            }),
          },
        ]),
      });
    }
  });
});

describe('selectPathTriggeredJobs', () => {
  const triggeredIds = (...changedFiles: string[]) =>
    selectPathTriggeredJobs(changedFiles).map(({ id }) => id);

  it.each(PATH_TRIGGERED_JOBS.flatMap(({ paths }) => paths))('%s exists', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(true);
  });

  it('adds nothing for a change outside every trigger path', () => {
    expect(triggeredIds('code/core/src/core-server/build-dev.ts', 'docs/index.mdx')).toEqual([]);
  });

  it('adds every path-triggered job when a global input changed', () => {
    expect(triggeredIds('yarn.lock')).toHaveLength(PATH_TRIGGERED_JOBS.length);
  });

  it('adds both init jobs for a CLI change and only init-features for a docs addon change', () => {
    expect(triggeredIds('code/lib/create-storybook/src/initiate.ts')).toEqual([
      'init-empty-react-vite-ts',
      'init-features',
    ]);
    expect(triggeredIds('code/addons/docs/src/preset.ts')).toEqual(['init-features']);
  });

  it("adds a renderer's portable stories job, and all of them for a preview-api change", () => {
    expect(triggeredIds('code/renderers/vue3/src/portable-stories.ts')).toEqual([
      'test-storybooks-portable-vue3',
    ]);
    expect(triggeredIds('code/core/src/preview-api/modules/store/csf/portable-stories.ts')).toEqual(
      [
        'test-storybooks-portable-react',
        'test-storybooks-portable-vue3',
        'test-storybooks-portable-svelte',
        'test-storybooks-portable-nextjs',
      ]
    );
  });

  it('adds the internal Storybook E2E and story tests for a manager change', () => {
    expect(triggeredIds('code/core/src/manager/App.tsx')).toEqual([
      'internal-storybook-e2e',
      'internal-storybook-build-e2e',
      'tests-stories--linux',
    ]);
  });
});

describe('defineAffectedLintAndFormat', () => {
  const runSteps = (...changedFiles: string[]) =>
    (
      getFocusJobs(changedFiles)
        .find(({ id }) => id === 'lint-and-format--affected')!
        .implementation('focus') as { steps: { run?: { name: string } }[] }
    ).steps.flatMap(({ run }) => (run && /Format|Lint/.test(run.name) ? [run] : []));

  it('checks only the changed files, linting each directory with paths relative to it', () => {
    expect(
      runSteps('code/core/src/manager/App.tsx', 'scripts/ci/focus.ts', 'docs/index.mdx')
    ).toEqual([
      expect.objectContaining({
        name: 'Format check changed files',
        environment: {
          FILES: 'code/core/src/manager/App.tsx\nscripts/ci/focus.ts\ndocs/index.mdx',
        },
      }),
      expect.objectContaining({
        name: 'Lint changed code files',
        working_directory: 'code',
        environment: { FILES: 'core/src/manager/App.tsx' },
      }),
      expect.objectContaining({
        name: 'Lint changed scripts files',
        working_directory: 'scripts',
        environment: { FILES: 'ci/focus.ts' },
      }),
    ]);
  });

  it('skips linting when no changed file is under code/ or scripts/', () => {
    expect(runSteps('docs/index.mdx').map(({ name }) => name)).toEqual([
      'Format check changed files',
    ]);
  });

  it.each([
    ['.oxfmtrc.json', ['Format check', 'Lint changed code files']],
    ['code/.oxlintrc.json', ['Format check changed files', 'Lint code JS', 'Lint scripts']],
    ['yarn.lock', ['Format check', 'Lint code JS', 'Lint scripts']],
  ])('checks everything it covers when %s changed', (configFile, stepNames) => {
    expect(runSteps('code/core/src/manager/App.tsx', configFile).map(({ name }) => name)).toEqual(
      stepNames
    );
  });
});
