function upgradeSeparator(path) {
  return path.replace(/[|.]/g, '/');
}

export default function transformer(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // storiesOf(...)
  root
    .find(j.CallExpression)
    .filter((call) => call.node.callee.name === 'storiesOf')
    .filter(
      (call) =>
        call.node.arguments.length > 0 &&
        ['Literal', 'StringLiteral'].includes(call.node.arguments[0].type)
    )
    .forEach((call) => {
      const arg0 = call.node.arguments[0];
      arg0.value = upgradeSeparator(arg0.value);
    });

  // export default { title: ... }
  root
    .find(j.ExportDefaultDeclaration)
    .filter((def) => def.node.declaration.properties.map((p) => p.key.name).includes('title'))
    .forEach((def) => {
      if (def.node.declaration && def.node.declaration.properties) {
        def.node.declaration.properties.forEach((p) => {
          if (p.key.name === 'title') {
            p.value.value = upgradeSeparator(p.value.value);
          }
        });
      }
    });

  return root.toSource({ quote: 'single' });
}
