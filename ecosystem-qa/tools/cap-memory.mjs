import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

// The rest stays with the host: on a GitHub runner that is the runner agent, the Docker daemon and
// run.ts itself.
const SHARE = 0.85;

/**
 * Limit the memory of every running sandbox container to a share of what the Docker daemon has, and
 * write what happened to `reportFile`, which sits in the run's evidence.
 *
 * Without a limit, a build that takes all the memory starves the host. On a GitHub runner the job
 * then ends with "lost communication" and no result. Under the limit the kernel ends that build
 * inside the container, and the agent sees its exit status.
 *
 * Never throws: a run without the limit is better than no run.
 */
const capMemory = (reportFile) => {
  let report;
  try {
    const limit = Math.floor(Number(docker('info', '--format', '{{.MemTotal}}')) * SHARE);
    const names = docker('ps', '--filter', 'name=^sandcastle-', '--format', '{{.Names}}')
      .split('\n')
      .filter(Boolean);
    for (const name of names) {
      // Equal values leave the container no swap on top of its memory.
      docker('update', '--memory', String(limit), '--memory-swap', String(limit), name);
    }
    report = `Memory limit of ${Math.round(limit / 2 ** 20)} MiB set on: ${names.join(', ') || 'no sandbox container'}`;
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

capMemory(process.argv[2]);
