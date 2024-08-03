// Compodoc does not follow symlinks (it ignores them and their contents entirely)
// So, we need to run a separate compodoc process on every symlink inside the project,
// then combine the results into one large documentation.json

import { join, resolve } from 'path';
import { realpath, readFile, writeFile, lstat } from 'node:fs/promises';
import { globSync } from 'glob';
import { execaCommand } from 'execa';
import { esMain } from './utils/esmain';

const logger = console;

// Find all symlinks in a directory. There may be more efficient ways to do this, but this works.
async function findSymlinks(dir: string) {
  const potentialDirs = await globSync(`${dir}/**/*/`);

  return (
    await Promise.all(
      potentialDirs.map(
        async (p) => [p, (await lstat(p.replace(/\/$/, ''))).isSymbolicLink()] as [string, boolean]
      )
    )
  )
    .filter(([, s]) => s)
    .map(([p]) => p);
}

async function run(cwd: string) {
  const dirs = [
    cwd,
    ...(await findSymlinks(resolve(cwd, './src'))),
    ...(await findSymlinks(resolve(cwd, './stories'))),
    ...(await findSymlinks(resolve(cwd, './template-stories'))),
  ];

  const docsArray: Record<string, any>[] = await Promise.all(
    dirs.map(async (dir) => {
      const { temporaryDirectory } = await import('tempy');
      const outputDir = temporaryDirectory();
      const resolvedDir = await realpath(dir);
      await execaCommand(
        `yarn compodoc ${resolvedDir} -p ./tsconfig.json -e json -d ${outputDir}`,
        { cwd }
      );
      const contents = await readFile(join(outputDir, 'documentation.json'), 'utf8');
      try {
        return JSON.parse(contents);
      } catch (err) {
        logger.error(`Error parsing JSON at ${outputDir}\n\n`);
        logger.error(contents);
        throw err;
      }
    })
  );

  // Compose together any array entries, discard anything else (we happen to only read the array fields)
  const documentation = docsArray.slice(1).reduce((acc, entry) => {
    return Object.fromEntries(
      Object.entries(acc).map(([key, accValue]) => {
        if (Array.isArray(accValue)) {
          return [key, [...accValue, ...entry[key]]];
        }
        return [key, accValue];
      })
    );
  }, docsArray[0]);

  await writeFile(join(cwd, 'documentation.json'), JSON.stringify(documentation));
}

if (esMain(import.meta.url)) {
  run(resolve(process.argv[2]))
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error();
      logger.error(err);
      process.exit(1);
    });
}
