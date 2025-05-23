// eslint-disable-next-line depend/ban-dependencies
import fs from 'fs-extra';
import { join, sep } from 'path';
import ts from 'typescript';

const run = async ({ cwd, flags }: { cwd: string; flags: string[] }) => {
  const {
    bundler: { tsConfig: tsconfigPath = 'tsconfig.json' },
  } = await fs.readJson(join(cwd, 'package.json'));

  const check = async (production: boolean) => {
    const { fileNames, options } = await getTSFilesAndConfig(tsconfigPath, production);
    const { program, host } = getTSProgramAndHost(fileNames, options);

    const tsDiagnostics = getTSDiagnostics(program, cwd, host);
    if (tsDiagnostics.length > 0) {
      console.log(tsDiagnostics);
      process.exit(1);
    } else {
      console.log(`no type errors in ${production ? 'dist' : 'src'} files`);
    }
  };

  await check(false);

  if (hasFlag(flags, 'production')) {
    await check(true);
  }

  // TODO, add more package checks here, like:
  // - check for missing dependencies/peerDependencies
  // - check for unused exports

  if (process.env.CI !== 'true') {
    console.log('done');
  }
};

const hasFlag = (flags: string[], name: string) => !!flags.find((s) => s.startsWith(`--${name}`));

const flags = process.argv.slice(2);
const cwd = process.cwd().replaceAll(sep, '/');

run({ cwd, flags }).catch((err: unknown) => {
  // We can't let the stack try to print, it crashes in a way that sets the exit code to 0.
  // Seems to have something to do with running JSON.parse() on binary / base64 encoded sourcemaps
  // in @cspotcode/source-map-support
  if (err instanceof Error) {
    console.error(err.message);
  }
  process.exit(1);
});

function getTSDiagnostics(program: ts.Program, cwd: string, host: ts.CompilerHost): any {
  return ts.formatDiagnosticsWithColorAndContext(
    ts.getPreEmitDiagnostics(program).filter((d) => d.file && d.file.fileName.startsWith(cwd)),
    host
  );
}

function getTSProgramAndHost(fileNames: string[], options: ts.CompilerOptions) {
  const program = ts.createProgram({
    rootNames: fileNames,
    options: {
      module: ts.ModuleKind.CommonJS,
      ...options,
      declaration: false,
      noEmit: true,
    },
  });

  const host = ts.createCompilerHost(program.getCompilerOptions());
  return { program, host };
}

async function getTSFilesAndConfig(tsconfigPath: string, production = false) {
  const content = await fs.readJson(tsconfigPath);
  if (production) {
    content.compilerOptions.skipLibCheck = false;
    delete content.compilerOptions.paths;
    content.include = ['dist/**/*'];
    content.exclude = ['**/node_modules'];
  }
  return ts.parseJsonConfigFileContent(
    content,
    {
      useCaseSensitiveFileNames: true,
      readDirectory: ts.sys.readDirectory,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
    },
    process.cwd(),
    {
      noEmit: true,
      outDir: join(process.cwd(), 'types'),
      target: ts.ScriptTarget.ES2022,
      declaration: false,
    }
  );
}
