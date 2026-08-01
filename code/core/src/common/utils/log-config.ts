import picocolors from 'picocolors';

export function logConfig(caption: unknown, config: unknown): void {
  console.log(picocolors.cyan(String(caption)));
  console.dir(config, { depth: null });
}
