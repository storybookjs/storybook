// Storybook packages that are not part of the monorepo but we maintain.
export default [
  '@storybook/test-runner',
  '@chromatic-com/storybook',
  '@storybook/addon-designs',
  '@storybook/addon-svelte-csf',
  '@storybook/addon-coverage',
  '@storybook/addon-webpack5-compiler-babel',
  '@storybook/addon-webpack5-compiler-swc',
  // Storybook for React Native related packages
  // TODO: For Storybook 10, we should check about possible automigrations
  '@storybook/addon-ondevice-actions',
  '@storybook/addon-ondevice-backgrounds',
  '@storybook/addon-ondevice-controls',
  '@storybook/addon-ondevice-notes',
  '@storybook/react-native',
];
