import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const activeNode = () => {
  try {
    return `Node ${execFileSync('node', ['--version'], { encoding: 'utf8' }).trim()} is active`;
  } catch (error) {
    return `node --version failed: ${error instanceof Error ? error.message : error}`;
  }
};

// Switch to the Node version the project in the current directory asks for, with `n`, and return one
// line that says what happened.
//
// Never throws: a project without a version file keeps the image's Node, and the install log shows
// any engine problem. A switch that outlasts `timeoutMs` is stopped, and the image's Node stays.
export const useNode = (version, timeoutMs) => {
  // Only a version file switches Node. An `engines` range stays with the image's Node: `n auto`
  // would resolve ">=24" to the newest major, which a project that merely sets a floor may not
  // support yet.
  const versionFile = ['.node-version', '.nvmrc'].find((name) => existsSync(name));
  const wanted = version ?? (versionFile && readFileSync(versionFile, 'utf8').trim());
  if (!wanted) {
    return `No Node version asked for. ${activeNode()}.`;
  }
  const { status, error } = spawnSync('n', [wanted.replace(/^v/, '')], {
    stdio: 'inherit',
    timeout: timeoutMs,
  });
  const outcome = error ? `could not run: ${error.message}` : `exited with ${status}`;
  return `\`n ${wanted}\` ${outcome}. ${activeNode()}.`;
};
