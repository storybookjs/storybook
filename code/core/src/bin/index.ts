import { spawn } from 'node:child_process';

import versions from '../common/versions';
import { resolveModule } from '../shared/utils/module';

async function main() {
  const args = process.argv.slice(2);

  if (['dev', 'build', 'index'].includes(args[0])) {
    const coreCli = resolveModule({ pkg: 'storybook', customSuffix: 'dist/cli/bin/index.js' });
    await import(coreCli);
    return;
  }

  const targetCli =
    args[0] === 'init'
      ? ({
          pkg: 'create-storybook',
          args: args.slice(1),
        } as const)
      : ({
          pkg: '@storybook/cli',
          args,
        } as const);

  let command;
  try {
    const { default: targetCliPackageJson } = await import(`${targetCli.pkg}/package.json`, {
      with: { type: 'json' },
    });
    if (targetCliPackageJson.version === versions[targetCli.pkg]) {
      command = [
        'node',
        resolveModule({ pkg: targetCli.pkg, customSuffix: 'bin/index.cjs' }),
        ...targetCli.args,
      ];
    }
  } catch (e) {
    // the package couldn't be imported, use npx to install and run it instead
  }
  command ??= ['npx', '--yes', `${targetCli.pkg}@${versions[targetCli.pkg]}`, ...targetCli.args];

  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code != null) {
      process.exit(code);
    }
    process.exit(1);
  });
}

main();
