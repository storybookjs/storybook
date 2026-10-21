import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { createContext, POC_DIR } from './context.mjs';

const [probeName, outFile] = process.argv.slice(2);
const ctx = createContext(probeName);
let result;
try {
  const mod = await import(pathToFileURL(path.join(POC_DIR, 'probes', `${probeName}.mjs`)).href);
  const raw = await mod.run(ctx);
  result = {
    probe: probeName,
    versions: mod.versions?.(ctx) ?? {},
    claims: ctx.claims,
    raw: raw ?? null,
  };
} catch (error) {
  result = { probe: probeName, claims: ctx.claims, fatal: String(error?.stack ?? error) };
}
writeFileSync(outFile, JSON.stringify(result, null, 2));
process.exit(0);
