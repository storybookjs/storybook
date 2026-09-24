// Reports the retained size of every open-service reconciler Log in a V8 heap snapshot.
// The reconciler keeps its Log in a closure; its context is the one holding `log`, `logKeys`, and
// `dropped`. Usage: node --max-old-space-size=16000 log-retained.mjs <file.heapsnapshot>
import { getFullHeapFromFile } from '@memlab/heap-analysis';

const file = process.argv[2];
const heap = await getFullHeapFromFile(file);
const rows = [];
heap.nodes.forEach((node) => {
  if (node.type !== 'object' || !node.name.startsWith('system / Context')) {
    return;
  }
  const edges = new Map(node.references.map((edge) => [String(edge.name_or_index), edge.toNode]));
  if (!edges.has('log') || !edges.has('logKeys') || !edges.has('dropped')) {
    return;
  }
  const log = edges.get('log');
  let serviceId = '?';
  // `serviceId` lives in an enclosing context (the createReconciler options destructure).
  for (let context = node; context && serviceId === '?'; ) {
    const refs = new Map(
      context.references.map((edge) => [String(edge.name_or_index), edge.toNode])
    );
    if (refs.has('serviceId')) {
      serviceId = refs.get('serviceId').name;
    }
    context = refs.get('previous');
  }
  rows.push({
    serviceId,
    entries: log.references.filter((e) => e.type === 'element').length,
    retainedMB: log.retainedSize / 2 ** 20,
  });
});
const totalMB = heap.nodes.length ? rows.reduce((a, r) => a + r.retainedMB, 0) : 0;
console.log(
  JSON.stringify(
    { file, totalHeapNodes: heap.nodes.length, logs: rows, totalLogRetainedMB: totalMB },
    null,
    2
  )
);
