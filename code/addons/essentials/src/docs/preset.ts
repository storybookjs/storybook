import { fileURLToPath } from 'node:url';

export * from '@storybook/addon-docs/preset';

export const mdxLoaderOptions = async (config: any) => {
  config.mdxCompileOptions.providerImportSource = fileURLToPath(
    import.meta.resolve('@storybook/addon-docs/mdx-react-shim')
  );
  return config;
};
