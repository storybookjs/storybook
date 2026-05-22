export function pickEnv(opts: {
  allow: readonly string[];
  extra?: Record<string, string | undefined>;
}): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of opts.allow) {
    if (process.env[k] !== undefined) out[k] = process.env[k];
  }
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}
