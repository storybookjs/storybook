import { readFileSync, writeFileSync } from 'node:fs';

import { join } from 'pathe';
import prettier from 'prettier';

import { ROOT_DIRECTORY } from './utils/constants';
import { getCodeWorkspaces } from './utils/workspace';

const workspaces = await getCodeWorkspaces(false);

// Remove scripts from each workspace
for (const workspace of workspaces) {
  const path = join(ROOT_DIRECTORY, 'code', workspace.location, 'package.json');

  // read scriptPath file
  const packageJson = JSON.parse(await readFileSync(path, 'utf-8'));

  delete packageJson['scripts'];
  // write scriptPath file
  // console.log(path, JSON.stringify(packageJson, null, 2));

  const data = JSON.stringify(packageJson, null, 2);

  await writeFileSync(path, await prettier.format(data, { filepath: path }));
}

//
// const projectJson = (name: string, framework: string, tags: string[], template: Template) => ({
//   name,
//   projectType: 'application',
//   implicitDependencies: [
//     'core',
//     'cli',
//     'addon-a11y',
//     'addon-docs',
//     'addon-vitest',
//     'addon-onboarding',
//     ...(!['storybook-framework-qwik', 'storybook-solidjs-vite'].includes(framework)
//       ? [framework]
//       : []),
//   ],
//   targets: {
//     sandbox: {
//       options: {
//         // Ensure Nx sandboxes write to a stable, slash-free folder name
//         // e.g. "react-vite/default-ts" -> "react-vite-default-ts"
//         dir: name.replaceAll('/', '-'),
//       },
//     },
//     'prepared-sandbox': {},
//     dev: {},
//     ...(template.typeCheck === true
//       ? {
//           'check-sandbox': {},
//         }
//       : {}),
//     ...(template.skipTasks && template.skipTasks.includes('vitest-integration')
//       ? {}
//       : {
//           'vitest-integration': {},
//         }),
//     'build-sandbox': {
//       options: {
//         dir: name.replaceAll('/', '-'),
//       },
//     },
//     'prepared-build-sandbox': {},
//     chromatic: {},
//     serve: {},
//     ...(template.skipTasks && template.skipTasks.includes('e2e-tests')
//       ? {}
//       : {
//           'e2e-tests': {},
//         }),
//     ...(template.skipTasks && template.skipTasks.includes('e2e-tests-dev')
//       ? {}
//       : {
//           'e2e-tests-dev': {},
//         }),
//     ...(template.skipTasks && template.skipTasks.includes('test-runner')
//       ? {}
//       : {
//           'test-runner': {},
//         }),
//     ...(template.skipTasks && template.skipTasks.includes('test-runner-dev')
//       ? {}
//       : {
//           'test-runner-dev': {},
//         }),
//   },
//   tags,
// });
// Object.entries(allTemplates)
//   .filter(([key]) => key !== 'svelte-kit/skeleton-ts')
//   .forEach(([key, value]) => {
//     const p = key.replaceAll('/', '-');
//     const full = join(process.cwd(), '../code/sandbox', p, 'project.json');
//
//     console.log(full);
//     const framework = value.expected.framework.replace('@storybook/', '');
//     console.log(framework);
//     console.log();
//     const tags = [
//       ...(normal.includes(key as any) && !value.inDevelopment ? ['ci:normal'] : []),
//       ...(merged.includes(key as any) && !value.inDevelopment ? ['ci:merged'] : []),
//       ...(daily.includes(key as any) && !value.inDevelopment ? ['ci:daily'] : []),
//     ];
//     ensureDirectoryExistence(full);
//     console.log(full);
//     writeFileSync(full, JSON.stringify(projectJson(key, framework, tags, value), null, 2), {
//       encoding: 'utf-8',
//     });
//   });
//
// function ensureDirectoryExistence(filePath: string): void {
//   const dir = dirname(filePath);
//   if (existsSync(dir)) {
//     return;
//   }
//   ensureDirectoryExistence(dir);
//   mkdirSync(dir);
// }
