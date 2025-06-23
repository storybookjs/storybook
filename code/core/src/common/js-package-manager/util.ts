// input: @storybook/addon-essentials@npm:7.0.0
// output: { name: '@storybook/addon-essentials', value: { version : '7.0.0', location: '' } }
export const parsePackageData = (packageName = '') => {
  const [first, second, third] = packageName
    .replace(/[└─├]+/g, '')
    .trim()
    .split('@');
  const version = (third || second).replace('npm:', '');
  const name = third ? `@${second}` : first;

  const value = { version, location: '' };
  return { name, value };
};
