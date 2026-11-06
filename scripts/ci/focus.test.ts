import { existsSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { allTemplates, daily, normal } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import {
  FOCUS_TEMPLATES,
  PATH_TRIGGERED_JOBS,
  getFocusJobs,
  selectChromaticSiblings,
  selectFocusSandboxes,
  selectPathTriggeredJobs,
  templateDirs,
} from './focus.ts';
import { defineSandboxFlow } from './sandboxes.ts';
import { ensureRequiredJobs } from './utils/helpers.ts';
import { getJobs } from './workflow-jobs.ts';

const ROOT = join(import.meta.dirname, '../..');

describe('FOCUS_TEMPLATES', () => {
  it('holds every ci:daily template except the prerelease and internal ones', () => {
    const excluded = daily.filter((key) => !FOCUS_TEMPLATES.includes(key));

    expect(excluded).toEqual(
      daily.filter((key) => key.includes('prerelease') || allTemplates[key].isInternal)
    );
    expect(excluded.some((key) => key.startsWith('bench/'))).toBe(true);
    expect(excluded.some((key) => key.includes('prerelease'))).toBe(true);
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

/** Every workspace package directory that some focus template loads, with a file inside it. */
const packageChanges = [
  ...new Set(FOCUS_TEMPLATES.flatMap((key) => Object.values(templateDirs(key)).flat())),
].map((dir) => ({ dir, file: `${dir}src/index.ts` }));
const loads = (key: string, dir: string) =>
  Object.values(templateDirs(key as (typeof FOCUS_TEMPLATES)[number])).some((dirs) =>
    dirs.includes(dir)
  );

describe('selectFocusSandboxes', () => {
  it.each(packageChanges)('runs a template that loads $dir', ({ dir, file }) => {
    expect(selectFocusSandboxes([file]).every((key) => loads(key, dir))).toBe(true);
  });

  const normalFocusTemplates = normal.filter((key) => FOCUS_TEMPLATES.includes(key));

  it.each(packageChanges.filter(({ dir }) => normalFocusTemplates.some((key) => loads(key, dir))))(
    'prefers a ci:normal template for $dir, which one loads',
    ({ file }) => {
      expect(selectFocusSandboxes([file]).every((key) => normal.includes(key))).toBe(true);
    }
  );

  it.each([
    'code/core/src/manager/App.tsx',
    'docs/get-started/introduction.mdx',
    'code/renderers/react/src/render.ts',
  ])('uses the React Vite sandbox for %s', (changedFile) => {
    expect(selectFocusSandboxes([changedFile])).toEqual(['react-vite/default-ts']);
  });

  it('prefers a framework match over a builder match', () => {
    expect(
      selectFocusSandboxes([
        'code/builders/builder-webpack5/src/index.ts',
        'code/frameworks/angular-vite/src/preset.ts',
      ])
    ).toEqual(['angular-vite/default-ts']);
  });

  it('runs one template in full for each changed package', () => {
    expect(
      selectFocusSandboxes([
        'code/renderers/react/src/render.ts',
        'code/renderers/vue3/src/render.ts',
      ])
    ).toEqual(['react-vite/default-ts', 'vue3-vite/default-ts']);
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
  it('selects nothing when no template package changed', () => {
    expect(
      selectChromaticSiblings(['react-vite/default-ts'], ['code/core/src/manager/App.tsx'])
    ).toEqual([]);
  });

  it.each([
    'code/core/template/stories/args.stories.ts',
    'code/core/template/__mocks__/lodash-es.js',
    'code/addons/docs/template/stories/docspage/basic.stories.ts',
  ])('covers every other template that runs Chromatic when %s changes', (file) => {
    expect(selectChromaticSiblings(['react-vite/default-ts'], [file]).toSorted()).toEqual(
      FOCUS_TEMPLATES.filter(
        (key) =>
          key !== 'react-vite/default-ts' && !allTemplates[key].skipTasks?.includes('chromatic')
      ).toSorted()
    );
  });

  it.each(packageChanges)(
    'covers every other template loading $dir that runs Chromatic',
    ({ dir, file }) => {
      const focused = selectFocusSandboxes([file]);
      const siblings = selectChromaticSiblings(focused, [file]);
      const expected = FOCUS_TEMPLATES.filter(
        (key) =>
          loads(key, dir) &&
          !focused.includes(key) &&
          !allTemplates[key].skipTasks?.includes('chromatic')
      );

      expect(siblings.toSorted()).toEqual(expected.toSorted());
    }
  );
});

describe('getFocusJobs', () => {
  const jobIds = (changedFiles: string[]) => getFocusJobs(changedFiles).map(({ id }) => id);

  it('runs the build, affected checks, and every React Vite sandbox job for a core change', () => {
    expect(jobIds(['code/core/src/core-server/build-dev.ts'])).toEqual([
      'build--linux',
      'typescript-validation--affected',
      'tests--linux--affected',
      'lint-and-format--affected',
      'local-storybook---chromatic',
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

/** `ci:normal` jobs that no focused run selects, and why. The nightly `ci:daily` run covers them. */
const NIGHTLY_ONLY_JOBS: Record<string, string> = {
  eslint: 'replaced by lint-and-format--affected',
  'format-check': 'replaced by lint-and-format--affected',
  'typescript-validation': 'replaced by typescript-validation--affected',
  'knip-validation': 'runs with --no-exit-code, so it cannot fail a run',
  'benchmark-packages': 'measures bundle sizes, not correctness',
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
  const internalTemplateJobs = new Set(
    normal
      .filter((key) => allTemplates[key].isInternal)
      .flatMap((key) => defineSandboxFlow(key).jobs.map(({ id }) => id))
  );

  it.each(normalJobs.filter((id) => !internalTemplateJobs.has(id)))(
    '%s runs in ci:focus or is listed as nightly-only',
    (id) => {
      expect(selectableByFocus.has(id) || id in NIGHTLY_ONLY_JOBS).toBe(true);
    }
  );

  it.each([...internalTemplateJobs])(
    '%s, of an internal template, never runs in ci:focus',
    (id) => {
      expect(normalJobs).toContain(id);
      expect(selectableByFocus.has(id)).toBe(false);
    }
  );

  it.each(Object.keys(NIGHTLY_ONLY_JOBS))(
    'nightly-only %s is a ci:normal job that ci:focus never selects',
    (id) => {
      expect(normalJobs).toContain(id);
      expect(selectableByFocus.has(id)).toBe(false);
    }
  );
});
