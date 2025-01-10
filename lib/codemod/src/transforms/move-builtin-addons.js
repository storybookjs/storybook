export default function transformer(file, api) {
  const j = api.jscodeshift;

  const createImportDeclaration = (specifiers, source) =>
    j.importDeclaration(
      specifiers.map((s) => j.importSpecifier(j.identifier(s))),
      j.literal(source)
    );

  const deprecates = {
    action: [['action'], '@storybook/addon-actions'],
    linkTo: [['linkTo'], '@storybook/addon-links'],
  };

  const transform = j(file.source)
    .find(j.ImportDeclaration)
    .filter((i) => i.value.source.value === '@storybook/react')
    .forEach((i) => {
      const importStatement = i.value;
      importStatement.specifiers = importStatement.specifiers.filter((specifier) => {
        const item = deprecates[specifier.local.name];
        if (item) {
          const [specifiers, moduleName] = item;
          i.insertAfter(createImportDeclaration(specifiers, moduleName));
          return false;
        }
        return specifier;
      });
    });

  return transform.toSource({ quote: 'single' });
}
