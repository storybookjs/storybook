// Diagnostic for #37221 (not for merging): every external node, compactly, as Nx sees it here.
import { createHash } from 'node:crypto';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
const graph = await createProjectGraphAsync({ exitOnError: false });
const short = (s: string) => createHash('md5').update(s).digest('hex').slice(0, 8);
const nodes = Object.entries(graph.externalNodes ?? {})
  .map(([k, v]) => `${k}=${short(JSON.stringify(v))}`)
  .sort();
process.stdout.write(`EXTCOUNT ${nodes.length}\n`);
process.stdout.write(`EXTNODES ${nodes.join(' ')}\n`);
