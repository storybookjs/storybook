import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { dirname, join } from 'pathe';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createModuleResolver } from './module-resolver.ts';

// The tsconfig files of `ng new`: the root one declares `paths` and includes no file itself.
const files = {
  'tsconfig.json': JSON.stringify({
    files: [],
    references: [{ path: './tsconfig.app.json' }],
    compilerOptions: { paths: { '@app/*': ['./src/app/*'] } },
  }),
  'tsconfig.app.json': JSON.stringify({ extends: './tsconfig.json', include: ['src/app/**/*.ts'] }),
  'src/app/button.ts': 'export const Button = 1;',
};

let project: string;

beforeAll(async () => {
  project = await realpath(await mkdtemp(join(tmpdir(), 'sb-module-resolver-')));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(project, name)), { recursive: true });
    await writeFile(join(project, name), content);
  }
});

afterAll(() => rm(project, { recursive: true, force: true }));

it.each(['src/app/in-the-app.ts', 'src/stories/button.stories.ts', '.storybook/preview.ts'])(
  'applies the paths of a root tsconfig that includes no file, from %s',
  async (importer) => {
    const resolver = createModuleResolver({ tsconfig: 'auto', extensions: ['.ts'] });
    const from = join(project, importer);
    const button = join(project, 'src/app/button.ts');

    expect(resolver.resolveFileSync(from, '@app/button')).toBe(button);
    expect(await resolver.resolveFile(from, '@app/button')).toBe(button);
  }
);

it('reports what the resolver said when no tsconfig helps', () => {
  const resolver = createModuleResolver({ tsconfig: 'auto', extensions: ['.ts'] });

  expect(() => resolver.resolveFileSync(join(project, 'src/a.ts'), '@app/missing')).toThrow();
});
