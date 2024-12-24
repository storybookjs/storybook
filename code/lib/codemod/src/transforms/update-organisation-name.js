export const packageNames = {
  '@kadira/react-storybook-decorator-centered': '@storybook/addon-centered',
  '@kadira/storybook-addons': 'storybook/internal/preview-api',
  '@kadira/storybook-addon-actions': '@storybook/addon-actions',
  '@kadira/storybook-addon-comments': '@storybook/addon-comments',
  '@kadira/storybook-addon-graphql': '@storybook/addon-graphql',
  '@kadira/storybook-addon-info': '@storybook/addon-info',
  '@kadira/storybook-addon-knobs': '@storybook/addon-knobs',
  '@kadira/storybook-addon-links': '@storybook/addon-links',
  '@kadira/storybook-addon-notes': '@storybook/addon-notes',
  '@kadira/storybook-addon-options': '@storybook/addon-options',
  '@kadira/storybook-channels': 'storybook/internal/channels',
  '@kadira/storybook-channel-postmsg': '@storybook/channel-postmessage',
  '@kadira/storybook-channel-websocket': '@storybook/channel-websocket',
  '@kadira/storybook-ui': 'storybook/internal/manager',
  '@kadira/react-native-storybook': '@storybook/react-native',
  '@kadira/react-storybook': '@storybook/react',
  '@kadira/getstorybook': 'storybook',
  '@kadira/storybook': '@storybook/react',
  storyshots: '@storybook/addon-storyshots',
  getstorybook: 'storybook',
};

export default function transformer(file, api) {
  const j = api.jscodeshift;

  const packageNamesKeys = Object.keys(packageNames);

  /**
   * Checks whether the node value matches a Storybook package
   *
   * @param {string} the Import declaration node
   * @returns {string} Whether the node value matches a Storybook package
   */
  const getMatch = (oldpart) => packageNamesKeys.find((newpart) => oldpart.match(newpart));

  /**
   * Returns the name of the Storybook packages with the organisation name, replacing the old
   * `@kadira/` prefix.
   *
   * @example
   *
   * ```ts
   * // returns '@storybook/storybook'
   * getNewPackageName('@kadira/storybook');
   * ```
   *
   * @param {string} oldPackageName The name of the old package
   * @returns {string} The new package name
   */
  const getNewPackageName = (oldPackageName) => {
    const match = getMatch(oldPackageName);

    if (match) {
      const replacement = packageNames[match];
      return oldPackageName.replace(match, replacement);
    }
    return oldPackageName;
  };

  /**
   * UpdatePackageName - updates the source name of the Storybook packages
   *
   * @param {ImportDeclaration} declaration The import declaration
   * @returns {ImportDeclaration.Node} The import declaration node
   */
  const updatePackageName = (declaration) => {
    declaration.node.source.value = getNewPackageName(declaration.node.source.value);

    return declaration.node;
  };

  return j(file.source)
    .find(j.ImportDeclaration)
    .replaceWith(updatePackageName)
    .toSource({ quote: 'single' });
}
