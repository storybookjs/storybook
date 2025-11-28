import detectFreePort from 'detect-port';
import killProcessOnPort from 'kill-port';

export const isPortUsed = async (port: number) => (await detectFreePort(port)) !== port;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const killPort = async (port: number) => {
  if (await isPortUsed(port)) {
    await killProcessOnPort(port);

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
