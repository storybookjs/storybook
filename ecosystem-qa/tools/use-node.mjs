import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Switch to the Node version the project in the current directory asks for, with `n`.
 *
 * Never throws: a project without a version file keeps the image's Node, and the install log shows
 * any engine problem.
 */
export const useNode = (version) => {
  // Only a version file switches Node. An `engines` range stays with the image's Node: `n auto`
  // would resolve ">=24" to the newest major, which a project that merely sets a floor may not
  // support yet.
  const versionFile = ['.node-version', '.nvmrc'].find((name) => existsSync(name));
  const wanted = version ?? (versionFile && readFileSync(versionFile, 'utf8').trim());
  if (wanted) {
    spawnSync('n', [wanted.replace(/^v/, '')], { stdio: 'inherit' });
  }
  const active = execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
  console.log(`Node ${active} is active`);
};
