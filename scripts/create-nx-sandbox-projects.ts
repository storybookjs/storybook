import * as fs from 'fs';
import * as path from 'path';

import * as templates from '../code/lib/cli-storybook/src/sandbox-templates';

// @ts-expect-error somehow TS thinks there is a default export
const { allTemplates, merged, daily, normal } = (templates.default ||
  templates) as typeof templates;

const projectJson = (name: string, framework: string, tags: string[]) => ({
  name,
  projectType: 'application',
  implicitDependencies: [
    'cli',
    'test',
    'essentials',
    'interactions',
    'links',
    'onboarding',
    'blocks',
    ...(!['storybook-framework-qwik', 'storybook-solidjs-vite'].includes(framework)
      ? [framework]
      : []),
  ],
  targets: {
    sandbox: {},
    'sb:dev': {},
    'sb:build': {},
  },
  tags,
});
Object.entries(allTemplates).forEach(([key, value]) => {
  const p = key.replaceAll('/', '-');
  const full = path.join(process.cwd(), '../code/sandbox', p, 'project.json');

  console.log(full);
  const framework = value.expected.framework.replace('@storybook/', '');
  console.log(framework);
  console.log();
  const tags = [
    ...(normal.includes(key as any) ? ['ci:normal'] : []),
    ...(merged.includes(key as any) ? ['ci:merged'] : []),
    ...(daily.includes(key as any) ? ['ci:daily'] : []),
  ];
  ensureDirectoryExistence(full);
  console.log(full);
  fs.writeFileSync(
    full,
    '// auto-generated from scripts/create-nx-sandbox-projects.ts\n' +
      JSON.stringify(projectJson(key, framework, tags), null, 2),
    {
      encoding: 'utf-8',
    }
  );
});

function ensureDirectoryExistence(filePath: string): void {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}
