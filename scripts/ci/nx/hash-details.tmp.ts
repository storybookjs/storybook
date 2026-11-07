// Diagnostic for #37221 (not for merging): every external node's hash, as Nx sees it here.
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
const graph = await createProjectGraphAsync({ exitOnError: false });
const nodes = Object.fromEntries(
  Object.entries(graph.externalNodes ?? {}).map(([k, v]) => [k, `${v.data.version}|${v.data.hash ?? ''}`])
);
process.stdout.write('EXTNODES ' + JSON.stringify(nodes) + '\n');
