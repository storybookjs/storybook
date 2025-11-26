import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import prettier from 'prettier';

import { type Template } from '../lib/cli-storybook/src/sandbox-templates';
import * as templates from '../lib/cli-storybook/src/sandbox-templates';

// @ts-expect-error somehow TS thinks there is a default export
const { allTemplates, merged, daily, normal } = (templates.default ||
  templates) as typeof templates;

const projectJson = (
  name: string,
  framework: string | undefined,
  tags: string[],
  template: Template
) => ({
  name,
  projectType: 'application',
  implicitDependencies: [
    'core',
    'cli',
    'addon-a11y',
    'addon-docs',
    'addon-vitest',
    'addon-onboarding',
    ...(framework ? [framework] : []),
  ],
  targets: {
    sandbox: {
      options: {
        // Ensure Nx sandboxes write to a stable, slash-free folder name
        // e.g. "react-vite/default-ts" -> "react-vite-default-ts"
        dir: name.replaceAll('/', '-'),
      },
    },
    'prepare-sandbox': {},
    dev: {},
    ...(template.typeCheck === true
      ? {
          'check-sandbox': {},
        }
      : {}),
    ...(template.skipTasks && template.skipTasks.includes('vitest-integration')
      ? {}
      : {
          'vitest-integration': {},
        }),
    build: {
      options: {
        dir: name.replaceAll('/', '-'),
      },
    },
    'prepare-build-sandbox': {},
    chromatic: {},
    serve: {},
    ...(template.skipTasks && template.skipTasks.includes('e2e-tests')
      ? {}
      : {
          'e2e-tests': {},
        }),
    ...(template.skipTasks && template.skipTasks.includes('e2e-tests-dev')
      ? {}
      : {
          'e2e-tests-dev': {},
        }),
    ...(template.skipTasks && template.skipTasks.includes('test-runner')
      ? {}
      : {
          'test-runner': {},
        }),
    ...(template.skipTasks && template.skipTasks.includes('test-runner-dev')
      ? {}
      : {
          'test-runner-dev': {},
        }),
  },
  tags,
});
await Promise.all(
  Object.entries(allTemplates).map(async ([key, value]) => {
    const p = key.replaceAll('/', '-');
    const full = join(process.cwd(), '../sandbox', p, 'project.json');

    console.log(full);
    const framework = value.expected.framework;
    const project = framework.includes('@storybook/')
      ? framework.replace('@storybook/', '')
      : undefined;
    console.log(project);
    console.log();
    const tags = [
      ...(normal.includes(key as any) && !value.inDevelopment ? ['ci:normal'] : []),
      ...(merged.includes(key as any) && !value.inDevelopment ? ['ci:merged'] : []),
      ...(daily.includes(key as any) && !value.inDevelopment ? ['ci:daily'] : []),
    ];
    ensureDirectoryExistence(full);
    console.log(full);

    const data = await prettier.format(JSON.stringify(projectJson(key, project, tags, value)), {
      filepath: full,
    });

    writeFileSync(full, data, { encoding: 'utf-8' });
  })
);

function ensureDirectoryExistence(filePath: string): void {
  const dir = dirname(filePath);
  if (existsSync(dir)) {
    return;
  }
  ensureDirectoryExistence(dir);
  mkdirSync(dir);
}
