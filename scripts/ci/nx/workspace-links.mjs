// The links Yarn makes from node_modules to the workspaces, as node_modules/.yarn-state.yml records
// them, for circleci-node-modules.sh. On Windows they are junctions, which tar does not archive as
// links, so the archive leaves them out and a restore makes them again.
//
//   workspace-links.mjs list  print where each link goes, one path per line
//   workspace-links.mjs make  make every link that is missing or points elsewhere
//
// Plain Node: it runs before anything is installed.
import fs from 'node:fs';
import path from 'node:path';

const STATE = 'node_modules/.yarn-state.yml';

/** Each link location with the workspace directory it points to. */
function links() {
  const result = [];
  let workspace;
  let inLocations = false;
  for (const line of fs.readFileSync(STATE, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('"')) {
      // A workspace's locator ends in `workspace:<directory>`.
      const match = /workspace:([^"]+)":$/.exec(line);
      workspace = match && match[1] !== '.' ? match[1] : undefined;
      inLocations = false;
    } else if (/^ {2}\S/.test(line)) {
      // `locations:`, or a field such as `aliases:`, whose items are locators, not paths.
      inLocations = line === '  locations:';
    } else if (workspace && inLocations) {
      const location = /^ {4}- "(.+)"$/.exec(line)?.[1];
      if (location) {
        result.push({ location, workspace });
      }
    }
  }
  // A state file with workspaces but none of their links found: the format is not what this reads.
  if (result.length === 0 && /workspace:(?!\.")/.test(fs.readFileSync(STATE, 'utf8'))) {
    throw new Error(`Found no workspace links in ${STATE}, which names workspaces.`);
  }
  return result;
}

const [mode] = process.argv.slice(2);
if (mode === 'list') {
  for (const { location } of links()) {
    console.log(location);
  }
} else if (mode === 'make') {
  let made = 0;
  const all = links();
  for (const { location, workspace } of all) {
    const target = path.resolve(workspace);
    let current;
    try {
      current = fs.realpathSync(location);
    } catch {}
    if (current === fs.realpathSync(target)) {
      continue;
    }
    fs.rmSync(location, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(location), { recursive: true });
    // As Yarn links them: a junction on Windows, which needs no symlink privilege.
    if (process.platform === 'win32') {
      fs.symlinkSync(target, location, 'junction');
    } else {
      fs.symlinkSync(path.relative(path.dirname(location), target), location);
    }
    made++;
  }
  console.log(`${all.length} workspace links, ${made} of them made.`);
} else {
  console.error('Usage: workspace-links.mjs list|make');
  process.exit(2);
}
