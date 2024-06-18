import { join, parse } from 'path';
import fs from 'fs-extra';
import dedent from 'ts-dedent';
import { build } from 'tsup';
import slash from 'slash';
import { exec } from '../utils/exec';

const hasFlag = (flags: string[], name: string) => !!flags.find((s) => s.startsWith(`--${name}`));

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    name,
    dependencies,
    peerDependencies,
    bundler: { entries, pre, post, shim },
  } = await fs.readJson(join(cwd, 'package.json'));

  const optimized = hasFlag(flags, 'optimized');

  if (pre) {
    await exec(`node --loader esbuild-register/loader -r esbuild-register ${pre}`, { cwd });
  }

  await Promise.all([
    ...entries.map(async (file: string) => {
      const { name: entryName } = parse(file);

      const dtsPathName = join(process.cwd(), 'dist', `${entryName}.d.ts`);
      const mjsPathName = join(process.cwd(), 'dist', `${entryName}.mjs`);

      await Promise.all([
        fs.ensureFile(dtsPathName).then(() =>
          fs.writeFile(
            dtsPathName,
            dedent`
            // shim-mmode
            export * from '${shim}';
          `
          )
        ),
        fs.ensureFile(mjsPathName).then(() =>
          fs.writeFile(
            mjsPathName,
            dedent`
            // shim-mmode
            export * from '${shim}';
          `
          )
        ),
      ]);
    }),
    build({
      entry: entries.map((e: string) => slash(join(cwd, e))),
      outDir: join(process.cwd(), 'dist'),
      format: ['cjs'],
      target: 'node18',
      platform: 'node',
      external: [name, ...Object.keys(dependencies || {}), ...Object.keys(peerDependencies || {})],

      esbuildOptions: (c) => {
        c.platform = 'node';
        c.legalComments = 'none';
        c.minifyWhitespace = optimized;
        c.minifyIdentifiers = optimized;
        c.minifySyntax = optimized;
      },
    }),
  ]);

  if (pre) {
    await exec(`node --loader esbuild-register/loader -r esbuild-register ${post}`, { cwd });
  }
};

const flags = process.argv.slice(2);
const cwd = process.cwd();

run({ cwd, flags }).catch((err: unknown) => {
  // We can't let the stack try to print, it crashes in a way that sets the exit code to 0.
  // Seems to have something to do with running JSON.parse() on binary / base64 encoded sourcemaps
  // in @cspotcode/source-map-support
  if (err instanceof Error) {
    console.error(err.message);
  }
  process.exit(1);
});
