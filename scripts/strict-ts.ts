import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';
import JSON5 from 'json5';

const files = glob.sync('**/*/tsconfig.json', {
  absolute: true,
  cwd: '..',
});

(async function main() {
  const packages = files
    .filter((file) => !file.includes('node_modules') && !file.includes('dist'))
    .map((file) => {
      const packageJson = join(dirname(file), 'package.json');
      let packageName;
      if (existsSync(packageJson)) {
        const json = readFileSync(packageJson, { encoding: 'utf-8' });
        packageName = JSON5.parse(json).name;
      }

      let strict;
      if (existsSync(file)) {
        const tsconfig = readFileSync(file, { encoding: 'utf-8' });
        const tsconfigJson = JSON5.parse(tsconfig);
        strict = tsconfigJson?.compilerOptions?.strict ?? false;
      }

      if (packageName && strict === false) {
        return packageName;
      }
      return null;
    })
    .filter(Boolean)
    .sort();

  console.log(packages.join('\n'));
  console.log(packages.length);

  // console.log(files.filter((file) => !file.includes('node_modules') && !file.includes('dist')));
})();
