// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

const isWindows = process.platform === 'win32';

/** Kills any process that is listening on the specified port. */
export const killProcessOnPort = async (port: number): Promise<void> => {
  try {
    let pids: string[] = [];

    if (isWindows) {
      // Windows: use netstat to find the process
      try {
        const { stdout } = await execa('netstat', ['-ano']);
        const lines = stdout.split('\n');
        const regex = new RegExp(`TCP.*:${port}.*LISTENING\\s+(\\d+)`, 'i');

        for (const line of lines) {
          const match = line.match(regex);
          if (match && match[1]) {
            pids.push(match[1]);
          }
        }
      } catch {
        // netstat failed, ignore
      }
    } else {
      // Unix-like (macOS, Linux): use lsof
      try {
        const { stdout } = await execa('lsof', ['-ti', `:${port}`]);
        pids = stdout.trim().split('\n').filter(Boolean);
      } catch {
        // lsof failed or no process found
      }
    }

    if (pids.length > 0) {
      console.log(`☠️ killing process(es) on port ${port}: ${pids.join(', ')}`);

      if (isWindows) {
        await Promise.all(
          pids.map((pid) => execa('taskkill', ['/PID', pid, '/F']).catch(() => {}))
        );
      } else {
        await Promise.all(pids.map((pid) => execa('kill', ['-9', pid]).catch(() => {})));
      }

      // Give the OS a moment to release the port
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    // No process found on port or command failed, which is fine
  }
};
