---
title: 'typescript'
---

Parent: [main.js|ts configuration](./main-config.md)

Type:

```ts
{
  check?: boolean;
  checkOptions?: CheckOptions;
  reactDocgen?: 'react-docgen' | 'react-docgen-typescript' | false;
  reactDocgenTypescriptOptions?: ReactDocgenTypescriptOptions;
  skipBabel?: boolean;
}
```

Configures how Storybook handles [TypeScript files](../configure/typescript.md).

## `check`

Type: `boolean`

Optionally run [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin). Note that because this uses a Webpack plugin, it is only available when using the [Webpack builder](../builders/webpack.md).

<CodeSnippets
paths={[
'common/main-config-typescript-check.ts.mdx',
]}
/>

## `checkOptions`

Type: `CheckOptions`

Options to pass to `fork-ts-checker-webpack-plugin`, if [enabled](#check). See [docs for available options](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/blob/v4.1.6/README.md#options).

<CodeSnippets
paths={[
'common/main-config-typescript-check-options.ts.mdx',
]}
/>

## `reactDocgen`

Type: `'react-docgen' | 'react-docgen-typescript' | false`

Default:

- `false`: if `@storybook/react` is not installed
- `'react-docgen'`: if `@storybook/react` is installed

Only available for React Storybook projects. Configure which library, if any, Storybook uses to parse React components, [react-docgen](https://github.com/reactjs/react-docgen) or [react-docgen-typescript](https://github.com/styleguidist/react-docgen-typescript). Set to `false` to disable parsing React components. `react-docgen-typescript` invokes the TypeScript compiler, which makes it slow but generally accurate. `react-docgen` performs its own analysis, which is much faster but incomplete.

<CodeSnippets
paths={[
'common/main-config-typescript-react-docgen.ts.mdx',
]}
/>

## `reactDocgenTypescriptOptions`

Type: `ReactDocgenTypescriptOptions`

Only available for React Storybook projects. Options to pass to react-docgen-typescript-plugin if react-docgen-typescript is enabled. See [docs for available options](https://github.com/hipstersmoothie/react-docgen-typescript-plugin).

<CodeSnippets
paths={[
'common/main-config-typescript-react-docgen-typescript-options.ts.mdx',
]}
/>

## `skipBabel`

Deprecated: Will be removed in Storybook 8.0. Use `skipCompiler` instead.

Type: `boolean`

Disable parsing of TypeScript files through Babel.

<CodeSnippets
paths={[
'common/main-config-typescript-skip-babel.ts.mdx',
]}
/>

## `skipCompiler`

Type: `boolean`

Disable parsing of TypeScript files through the compiler, which is used for Webpack5.

<CodeSnippets
paths={[
'common/main-config-typescript-skip-compiler.ts.mdx',
]}
/>
