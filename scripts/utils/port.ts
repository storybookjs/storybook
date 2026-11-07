import detectFreePort from 'detect-port';
import killProcessOnPort from 'kill-port';

export const isPortUsed = async (port: number) => (await detectFreePort(port)) !== port;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const killPort = async (port: number) => {
  if (await isPortUsed(port)) {
    // The process can exit between the check and the kill, as when NX stops a worker's previous
    // registry while the next task starts one; kill-port then rejects with "No process running on
    // port". The wait below still fails when the port stays taken.
    await killProcessOnPort(port).catch(() => {});

    let attempts = 0;
    while ((await isPortUsed(port)) && attempts < 20) {
      await sleep(1000);
      attempts++;
    }
    if (await isPortUsed(port)) {
      throw new Error(`Failed to free port ${port} after ${attempts} attempts`);
    }
  }
};
