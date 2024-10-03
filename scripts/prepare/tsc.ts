import { emptyDir, move, readJson } from 'fs-extra';
import { join } from 'path';
import { glob } from 'tinyglobby';
import * as ts from 'typescript';

import { exec } from '../utils/exec';

const hasFlag = (flags: string[], name: string) => !!flags.find((s) => s.startsWith(`--${name}`));

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    bundler: { pre, post, tsConfig: tsconfigPath = 'tsconfig.json' },
  } = await readJson(join(cwd, 'package.json'));

  if (pre) {
    await exec(`jiti ${pre}`, { cwd });
  }

  const reset = hasFlag(flags, 'reset');
  const watch = hasFlag(flags, 'watch');
  // const optimized = hasFlag(flags, 'optimized');

  if (reset) {
    await emptyDir(join(process.cwd(), 'dist'));
  }

  const content = ts.readJsonConfigFile(tsconfigPath, ts.sys.readFile);

  const out = ts.parseJsonSourceFileConfigFileContent(
    content,
    {
      useCaseSensitiveFileNames: true,
      readDirectory: ts.sys.readDirectory,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
    },
    process.cwd(),
    {
      noEmit: false,
      outDir: join(process.cwd(), 'dist'),
      target: ts.ScriptTarget.ES2020,
      declaration: true,
      sourceMap: false,
    }
  );

  const compilerOptions = out.options;

  if (watch) {
    const watcher = ts.createWatchProgram(
      ts.createWatchCompilerHost(tsconfigPath, compilerOptions, ts.sys)
    );
    watcher.getProgram().emit();
  } else {
    ts.createProgram({
      rootNames: out.fileNames,
      options: { ...compilerOptions, module: ts.ModuleKind.ES2020, declaration: false },
    }).emit();

    const files = await glob(join(process.cwd(), 'dist', '*.js'));
    await Promise.all(files.map((file) => move(file, file.replace('.js', '.mjs'), {})));

    ts.createProgram({
      rootNames: out.fileNames,
      options: { ...compilerOptions, module: ts.ModuleKind.CommonJS },
    }).emit();
  }

  if (post) {
    await exec(`jiti ${post}`, { cwd }, { debug: true });
  }

  if (!watch) {
    if (process.env.CI !== 'true') {
      console.log('done');
    }
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
