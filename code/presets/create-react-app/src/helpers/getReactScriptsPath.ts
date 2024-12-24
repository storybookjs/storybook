import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const getReactScriptsPath = (): string => {
  const cwd = process.cwd();
  const scriptsBinPath = join(cwd, '/node_modules/.bin/react-scripts');

  if (process.platform === 'win32') {
    /*
     * Try to find the scripts package on Windows by following the `react-scripts` CMD file.
     * https://github.com/storybookjs/storybook/issues/5801
     */
    try {
      const content = readFileSync(scriptsBinPath, 'utf8');

      const packagePathMatch = content.match(
        /"\$basedir[\\/](\S+?)[\\/]bin[\\/]react-scripts\.js"/i
      );

      if (packagePathMatch && packagePathMatch.length > 1) {
        const scriptsPath = join(cwd, '/node_modules/.bin/', packagePathMatch[1]);
        return scriptsPath;
      }
    } catch (e) {
      // NOOP
    }
  } else {
    /*
     * Try to find the scripts package by following the `react-scripts` symlink.
     * This won't work for Windows users, unless within WSL.
     */
    try {
      const scriptsBinPathStat = lstatSync(scriptsBinPath);
      if (scriptsBinPathStat.isSymbolicLink() === true) {
        const resolvedBinPath = realpathSync(scriptsBinPath);
        const scriptsPath = join(resolvedBinPath, '..', '..');
        return scriptsPath;
      }
      if (scriptsBinPathStat.isFile() === true) {
        const scriptsPath = join(cwd, '/node_modules/react-scripts');
        return scriptsPath;
      }
    } catch (e) {
      // NOOP
    }
  }

  /*
   * Try to find the `react-scripts` package by name (won't catch forked scripts packages).
   */
  try {
    const scriptsPath = dirname(require.resolve('react-scripts/package.json'));
    return scriptsPath;
  } catch (e) {
    // NOOP
  }

  return '';
};
