import fsSync from 'node:fs';
import path from 'node:path';

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
      const packageJson = path.join(path.dirname(file), 'package.json');
      let packageName;
      if (fsSync.existsSync(packageJson)) {
        const json = fsSync.readFileSync(packageJson, { encoding: 'utf-8' });
        packageName = JSON5.parse(json).name;
      }

      let strict;
      if (fsSync.existsSync(file)) {
        const tsconfig = fsSync.readFileSync(file, { encoding: 'utf-8' });
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
