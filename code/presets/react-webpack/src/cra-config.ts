import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { logger } from 'storybook/internal/node-logger';

const appDirectory = fs.realpathSync(process.cwd());

let reactScriptsPath: string;

export function getReactScriptsPath({ noCache }: { noCache?: boolean } = {}) {
  if (reactScriptsPath && !noCache) return reactScriptsPath;

  let reactScriptsScriptPath = fs.realpathSync(
    path.join(appDirectory, '/node_modules/.bin/react-scripts')
  );

  try {
    // Note: Since there is no symlink for .bin/react-scripts on Windows
    // we'll parse react-scripts file to find actual package path.
    // This is important if you use fork of CRA.

    const pathIsNotResolved = /node_modules[\\/]\.bin[\\/]react-scripts/i.test(
      reactScriptsScriptPath
    );

    if (pathIsNotResolved) {
      const content = fs.readFileSync(reactScriptsScriptPath, 'utf8');
      const packagePathMatch = content.match(
        /"\$basedir[\\/]([^\s]+?[\\/]bin[\\/]react-scripts\.js")/i
      );

      if (packagePathMatch && packagePathMatch.length > 1) {
        reactScriptsScriptPath = path.join(
          appDirectory,
          '/node_modules/.bin/',
          packagePathMatch[1]
        );
      }
    }
  } catch (e) {
    logger.warn(`Error occurred during react-scripts package path resolving: ${e}`);
  }

  reactScriptsPath = path.join(reactScriptsScriptPath, '../..');
  const scriptsPkgJson = path.join(reactScriptsPath, 'package.json');

  if (!fs.existsSync(scriptsPkgJson)) {
    reactScriptsPath = 'react-scripts';
  }

  return reactScriptsPath;
}

export function isReactScriptsInstalled(requiredVersion = '2.0.0') {
  try {
    const reactScriptsJson = require(path.join(getReactScriptsPath(), 'package.json'));
    return !semver.gtr(requiredVersion, reactScriptsJson.version);
  } catch (e) {
    return false;
  }
}
