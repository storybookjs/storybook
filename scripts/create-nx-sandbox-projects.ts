import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import * as templates from '../code/lib/cli-storybook/src/sandbox-templates';

// @ts-expect-error somehow TS thinks there is a default export
const { allTemplates, merged, daily, normal } = (templates.default ||
  templates) as typeof templates;

const projectJson = (name: string, framework: string, tags: string[], skipTasks?: string[]) => ({
  name,
  projectType: 'application',
  implicitDependencies: [
    'core',
    'addon-links',
    'addon-onboarding',
    ...(!['storybook-framework-qwik', 'storybook-solidjs-vite'].includes(framework)
      ? [framework]
      : []),
  ],
  targets: {
    sandbox: {
      options: {
        // Ensure Nx sandboxes write to a stable, slash-free folder name
        // e.g. "react-vite/default-ts" -> "react-vite-default-ts"
        outputPath: name.replaceAll('/', '-'),
      },
    },
    'build-sandbox': {
      options: {
        outputPath: name.replaceAll('/', '-'),
      },
    },
    chromatic: {},
    serve: {},
    ...(skipTasks && skipTasks.includes('e2e-tests')
      ? {}
      : {
          'e2e-tests': {},
        }),
  },
  tags,
});
Object.entries(allTemplates).forEach(([key, value]) => {
  const p = key.replaceAll('/', '-');
  const full = join(process.cwd(), '../code/sandbox', p, 'project.json');

  console.log(full);
  const framework = value.expected.framework.replace('@storybook/', '');
  console.log(framework);
  console.log();
  const tags = [
    ...(normal.includes(key as any) && !value.inDevelopment ? ['ci:normal'] : []),
    ...(merged.includes(key as any) && !value.inDevelopment ? ['ci:merged'] : []),
    ...(daily.includes(key as any) && !value.inDevelopment ? ['ci:daily'] : []),
  ];
  ensureDirectoryExistence(full);
  console.log(full);
  writeFileSync(full, JSON.stringify(projectJson(key, framework, tags, value.skipTasks), null, 2), {
    encoding: 'utf-8',
  });
});

function ensureDirectoryExistence(filePath: string): void {
  const dir = dirname(filePath);
  if (existsSync(dir)) {
    return;
  }
  ensureDirectoryExistence(dir);
  mkdirSync(dir);
}
