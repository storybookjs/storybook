import { execFileSync } from 'node:child_process';
import { realpathSync, writeFileSync } from 'node:fs';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

// The rest stays with the host: on a GitHub runner that is the runner agent, the Docker daemon and
// run.ts itself.
const SHARE = 0.85;

const realPath = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// Sandcastle runs a host hook in the worktree of its run, and only that run's container mounts it.
const containersOfThisRun = () => {
  const worktree = realPath(process.cwd());
  return docker('ps', '--filter', 'name=^sandcastle-', '--format', '{{.Names}}')
    .split('\n')
    .filter(Boolean)
    .filter((name) =>
      docker('inspect', '--format', '{{range .Mounts}}{{println .Source}}{{end}}', name)
        .split('\n')
        .some((source) => source && realPath(source) === worktree)
    );
};

// Limit the memory of this run's sandbox container to a share of what the Docker daemon has, write
// what happened to `reportFile`, which sits in the run's evidence, and the name of the container to
// `nameFile`, because the runner learns it from Sandcastle only after the project install.
//
// Without a limit, a build that takes all the memory starves the host. On a GitHub runner the job
// then ends with "lost communication" and no result. Under the limit the kernel ends that build
// inside the container only when it can free nothing at all. A build that leaves it something to
// free stalls instead: the kernel takes the code of the processes out of memory and reads it back.
//
// Never throws: a run without the limit is better than no run.
const capMemory = (reportFile, nameFile) => {
  let report;
  try {
    const limit = Math.floor(Number(docker('info', '--format', '{{.MemTotal}}')) * SHARE);
    const names = containersOfThisRun();
    for (const name of names) {
      // Equal values leave the container no swap on top of its memory.
      docker('update', '--memory', String(limit), '--memory-swap', String(limit), name);
    }
    report = `Memory limit of ${Math.round(limit / 2 ** 20)} MiB set on: ${names.join(', ') || 'no sandbox container'}`;
    if (nameFile && names.length === 1) {
      writeFileSync(nameFile, `${names[0]}\n`);
    }
  } catch (error) {
    report = `The sandbox memory was not limited: ${error instanceof Error ? error.message : error}`;
  }
  console.log(report);
  if (reportFile) {
    try {
      writeFileSync(reportFile, `${report}\n`);
    } catch {
      // A report that cannot be written must not end the run either.
    }
  }
};

capMemory(process.argv[2], process.argv[3]);
