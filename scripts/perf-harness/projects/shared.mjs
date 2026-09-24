// One entry per component id, in index order: the id docgen keys by, and the story file importing it.
export function componentsFromIndex(index) {
  const byComponent = new Map();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story') {
      continue;
    }
    const componentId = entry.id.split('--')[0];
    if (!byComponent.has(componentId)) {
      byComponent.set(componentId, {
        componentId,
        importPath: entry.importPath,
        componentPath: entry.componentPath,
      });
    }
  }
  return [...byComponent.values()];
}

// Splits `items` into disjoint lists of the given sizes, each spread evenly over the whole list.
export function spreadTargets(items, sizes) {
  const total = sizes.reduce((a, b) => a + b, 0);
  const step = Math.max(1, Math.floor(items.length / total));
  const picked = [];
  for (let i = 0; picked.length < total && i < items.length; i += step) {
    picked.push(items[i]);
  }
  const lists = [];
  let offset = 0;
  for (const size of sizes) {
    lists.push(picked.slice(offset, offset + size));
    offset += size;
  }
  return lists;
}
