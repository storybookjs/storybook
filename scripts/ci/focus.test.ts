import { existsSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import {
  allTemplates,
  daily,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import {
  FOCUS_TEMPLATES,
  PATH_TRIGGERED_JOBS,
  getFocusJobs,
  selectChromaticSiblings,
  selectFocusSandboxes,
  selectPathTriggeredJobs,
  templateDirs,
} from './focus.ts';
import { ensureRequiredJobs } from './utils/helpers.ts';
import { getJobs } from './workflow-jobs.ts';

const ROOT = join(import.meta.dirname, '../..');

describe('FOCUS_TEMPLATES', () => {
  it('holds every ci:daily template except the prerelease ones', () => {
    const prerelease = daily.filter((key) => !FOCUS_TEMPLATES.includes(key));

    expect(prerelease.length).toBeGreaterThan(0);
    expect(prerelease.every((key) => key.includes('prerelease'))).toBe(true);
  });

  it.each(FOCUS_TEMPLATES)(
    '%s loads packages from existing directories of this repository',
    (key) => {
      const dirs = Object.values(templateDirs(key)).flat();

      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs.every((dir) => existsSync(join(ROOT, dir)))).toBe(true);
    }
  );
});

describe('selectFocusSandboxes', () => {
  it.each([
    ['code/frameworks/angular/src/server/index.ts', 'angular-cli/default-ts'],
    ['code/frameworks/angular-vite/src/preset.ts', 'angular-vite/default-ts'],
    ['code/frameworks/nextjs/src/preset.ts', 'nextjs/default-ts'],
    ['code/frameworks/nextjs-vite/src/preset.ts', 'nextjs-vite/default-ts'],
    ['code/frameworks/react-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/frameworks/react-webpack5/src/preset.ts', 'react-webpack/18-ts'],
    ['code/frameworks/sveltekit/src/preset.ts', 'svelte-kit/skeleton-ts'],
    ['code/frameworks/tanstack-react/src/preset.ts', 'tanstack-react-router/default-ts'],
    ['code/frameworks/react-native-web-vite/src/preset.ts', 'react-native-web-vite/expo-ts'],
  ])(
    'maps the framework change %s to its first template in cadence order',
    (changedFile, expected) => {
      expect(selectFocusSandboxes([changedFile])).toEqual([expected]);
    }
  );

  it.each([
    ['code/renderers/react/src/render.ts', 'react-vite/default-ts'],
    ['code/renderers/vue3/src/render.ts', 'vue3-vite/default-ts'],
    ['code/renderers/svelte/src/render.ts', 'svelte-vite/default-ts'],
    ['code/renderers/web-components/src/render.ts', 'lit-vite/default-ts'],
    ['code/renderers/html/src/render.ts', 'html-vite/default-ts'],
    ['code/renderers/preact/src/render.ts', 'preact-vite/default-ts'],
  ])(
    'maps the renderer change %s to its first template in cadence order',
    (changedFile, expected) => {
      expect(selectFocusSandboxes([changedFile])).toEqual([expected]);
    }
  );

  it.each([
    [
      'code/builders/builder-webpack5/src/index.ts',
      ['angular-cli/default-ts', 'nextjs/default-ts', 'react-webpack/18-ts', 'nextjs/15-ts'],
    ],
    [
      'code/lib/core-webpack/src/to-importFn.ts',
      ['angular-cli/default-ts', 'nextjs/default-ts', 'react-webpack/18-ts', 'nextjs/15-ts'],
    ],
    [
      'code/presets/react-webpack/src/index.ts',
      ['nextjs/default-ts', 'react-webpack/18-ts', 'nextjs/15-ts'],
    ],
    [
      'code/lib/vite-plugin-storybook-nextjs/src/index.ts',
      ['nextjs-vite/default-ts', 'nextjs-vite/15-ts'],
    ],
    [
      'code/lib/angular-compodoc/src/index.ts',
      ['angular-cli/default-ts', 'angular-vite/default-ts', 'angular-vite/21-ts'],
    ],
  ])('maps the shared package change %s to every template loading it', (changedFile, expected) => {
    expect(selectFocusSandboxes([changedFile])).toEqual(expected);
  });

  it.each([
    'code/builders/builder-vite/src/index.ts',
    'code/core/src/manager/App.tsx',
    'docs/get-started/introduction.mdx',
  ])('tests %s in the React Vite sandbox alone', (changedFile) => {
    expect(selectFocusSandboxes([changedFile])).toEqual(['react-vite/default-ts']);
  });

  it('prefers a framework match over a shared builder match', () => {
    expect(
      selectFocusSandboxes([
        'code/builders/builder-webpack5/src/index.ts',
        'code/frameworks/angular-vite/src/preset.ts',
      ])
    ).toEqual(['angular-vite/default-ts']);
  });

  it('never picks a prerelease or internal template', () => {
    const selectable = daily.flatMap((key) =>
      Object.values(templateDirs(key)).flatMap((dirs) =>
        dirs.flatMap((dir) => selectFocusSandboxes([`${dir}src/index.ts`]))
      )
    );

    expect(selectable.some((key) => key.includes('prerelease'))).toBe(false);
    expect(selectable.some((key) => allTemplates[key].isInternal)).toBe(false);
  });
});

describe('selectChromaticSiblings', () => {
  it.each([
    ['core', 'code/core/src/manager/App.tsx'],
    ['a builder', 'code/builders/builder-vite/src/index.ts'],
  ])('selects nothing when only %s changed', (_, changedFile) => {
    expect(selectChromaticSiblings(['react-vite/default-ts'], [changedFile])).toEqual([]);
  });

  it.each([
    [
      'code/frameworks/react-vite/src/preset.ts',
      'react-vite/default-ts',
      ['bench/react-vite-default-ts-test-build', 'react-vite/default-js'],
    ],
    ['code/frameworks/nextjs-vite/src/preset.ts', 'nextjs-vite/default-ts', ['nextjs-vite/15-ts']],
    [
      'code/frameworks/angular-vite/src/preset.ts',
      'angular-vite/default-ts',
      ['angular-vite/21-ts'],
    ],
    [
      'code/frameworks/tanstack-react/src/preset.ts',
      'tanstack-react-router/default-ts',
      ['tanstack-react-start/default-ts'],
    ],
  ])(
    'selects the other templates of the changed framework %s',
    (changedFile, focused, expected) => {
      expect(selectChromaticSiblings([focused as TemplateKey], [changedFile])).toEqual(expected);
    }
  );

  it('selects every other non-prerelease ci:daily template of a changed renderer that runs Chromatic', () => {
    const siblings = selectChromaticSiblings(
      ['react-vite/default-ts'],
      ['code/renderers/react/src/render.ts']
    );

    expect(siblings).toEqual(
      expect.arrayContaining([
        'nextjs/default-ts',
        'nextjs/15-ts',
        'react-vite/default-js',
        'bench/react-vite-default-ts-test-build',
      ])
    );
    expect(siblings).not.toContain('react-vite/default-ts');
    expect(siblings).not.toContain('nextjs/prerelease');
    expect(siblings).not.toContain('bench/react-vite-default-ts-nodocs');
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

  it.each(['yarn.lock', 'code/addons/a11y/src/__snapshots__/a11yRunner.test.ts.snap'])(
    'runs the full unit suite instead of the affected tests when %s changed',
    (file) => {
      const ids = jobIds(['code/core/src/manager/App.tsx', file]);

      expect(ids).toContain('tests--linux');
      expect(ids).not.toContain('tests--linux--affected');
    }
  );

  it('adds only the create and Chromatic jobs of each sibling', () => {
    const ids = jobIds(['code/renderers/react/src/render.ts']);

    expect(ids.filter((id) => id.startsWith('tanstack-react-start-'))).toEqual([
      'tanstack-react-start-latest--vite---typescript---create',
      'tanstack-react-start-latest--vite---typescript---chromatic',
    ]);
  });

  it('runs one Svelte template in full and the others as Chromatic siblings', () => {
    const ids = jobIds(['code/renderers/svelte/src/render.ts']);

    expect(ids.filter((id) => id.startsWith('svelte-latest--vite---typescript---'))).toHaveLength(
      5
    );
    expect(ids.filter((id) => id.startsWith('sveltekit-'))).toEqual([
      'sveltekit-latest--vite---typescript---create',
      'sveltekit-latest--vite---typescript---chromatic',
    ]);
    expect(ids.filter((id) => id.startsWith('svelte-latest--vite---javascript---'))).toEqual([
      'svelte-latest--vite---javascript---create',
      'svelte-latest--vite---javascript---chromatic',
    ]);
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

  it("adds a renderer's portable stories job, and all of them for a preview-api or CSF change", () => {
    expect(triggeredIds('code/renderers/vue3/src/portable-stories.ts')).toEqual([
      'test-storybooks-portable-vue3',
    ]);
    for (const file of [
      'code/core/src/preview-api/modules/store/csf/portable-stories.ts',
      'code/core/src/csf/csf-utils.ts',
    ]) {
      expect(triggeredIds(file)).toEqual([
        'test-storybooks-portable-react',
        'test-storybooks-portable-vue3',
        'test-storybooks-portable-svelte',
        'test-storybooks-portable-nextjs',
      ]);
    }
  });

  it('adds the React portable stories job, which runs the Vitest plugin, for a Vitest addon change', () => {
    expect(triggeredIds('code/addons/vitest/src/vitest-plugin/index.ts')).toEqual([
      'init-features',
      'test-storybooks-portable-react',
    ]);
  });

  it('adds the internal Storybook E2E, story tests, and Chromatic for a manager change', () => {
    expect(triggeredIds('code/core/src/manager/App.tsx')).toEqual([
      'internal-storybook-e2e',
      'internal-storybook-build-e2e',
      'tests-stories--linux',
      'local-storybook---chromatic',
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

/** `ci:normal` jobs that no focused run selects, and why. The nightly `ci:daily` run covers them. */
const NIGHTLY_ONLY_JOBS: Record<string, string> = {
  eslint: 'replaced by lint-and-format--affected',
  'format-check': 'replaced by lint-and-format--affected',
  'typescript-validation': 'replaced by typescript-validation--affected',
  'knip-validation': 'runs with --no-exit-code, so it cannot fail a run',
  'benchmark-packages': 'measures bundle sizes, not correctness',
  'bench--react-vite-default-ts---create': 'benchmark sandbox',
  'bench--react-vite-default-ts---dev': 'benchmark sandbox',
  'bench--react-webpack-18-ts---create': 'benchmark sandbox',
  'bench--react-webpack-18-ts---dev': 'benchmark sandbox',
  'bench--react-vite-default-ts--no-docs---create': 'benchmark sandbox',
  'bench--react-vite-default-ts--no-docs---dev': 'benchmark sandbox',
  'bench--react-vite-default-ts--test-build---dev':
    'benchmark sandbox; focus runs its create and Chromatic jobs as a React sibling',
  'bench--react-webpack-18-ts--test-build---dev':
    'benchmark sandbox; focus runs its create and Chromatic jobs as a React sibling',
  'tanstack-react-start-latest--vite---typescript---dev':
    'TanStack Router runs the tanstack-react framework in full; focus runs Start as a sibling',
  'tanstack-react-start-latest--vite---typescript---vitest':
    'TanStack Router runs the tanstack-react framework in full; focus runs Start as a sibling',
  'tanstack-react-start-latest--vite---typescript---e2e':
    'TanStack Router runs the tanstack-react framework in full; focus runs Start as a sibling',
};

describe('ci:normal coverage', () => {
  const ids = (jobs: Parameters<typeof ensureRequiredJobs>[0]) =>
    ensureRequiredJobs(jobs).map(({ id }) => id);

  const selectableByFocus = new Set(
    [
      ['yarn.lock'],
      ...FOCUS_TEMPLATES.flatMap((key) =>
        Object.values(templateDirs(key)).flatMap((dirs) =>
          dirs.map((dir) => [`${dir}src/index.ts`])
        )
      ),
    ].flatMap((changedFiles) => ids(getFocusJobs(changedFiles)))
  );
  const normalJobs = ids(getJobs('normal', 'origin/next'));

  it.each(normalJobs)('%s runs in ci:focus or is listed as nightly-only', (id) => {
    expect(selectableByFocus.has(id) || id in NIGHTLY_ONLY_JOBS).toBe(true);
  });

  it.each(Object.keys(NIGHTLY_ONLY_JOBS))(
    'nightly-only %s is a ci:normal job that ci:focus never selects',
    (id) => {
      expect(normalJobs).toContain(id);
      expect(selectableByFocus.has(id)).toBe(false);
    }
  );
});
