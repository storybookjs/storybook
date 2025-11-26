## 4.1.2

- Use overrides from SB rather than defining ourselves [#254](https://github.com/storybookjs/presets/pull/254)

## 4.1.1

- Update peer dependencies and add a note about versions [#252](https://github.com/storybookjs/presets/pull/252)

## 4.1.0

- Add support for builder.core options to CRA preset [#240](https://github.com/storybookjs/presets/pull/240)

## 4.0.2

- Fix bug merging core presets [#238](https://github.com/storybookjs/presets/pull/238) [#239](https://github.com/storybookjs/presets/pull/239)

## 4.0.1

- Support CJS files using Storybook's config [#229](https://github.com/storybookjs/presets/pull/229)

## 4.0.0

- CRA: Add compatibility for CRA v5 [#214](https://github.com/storybookjs/presets/pull/214)

## 3.2.0

- Add disableWebpackDefaults for forward-compatibility with SB core

## 3.1.7

- CRA: Fix fast refresh config [#193](https://github.com/storybookjs/presets/pull/193)

## 3.1.6

- Fix monorepos and PnP [#181](https://github.com/storybookjs/presets/pull/181)

## 3.1.5

- Fix duplicate ReactDocgenTypescriptPlugin [#173](https://github.com/storybookjs/presets/pull/173)
- Bump react-docgen-typescript-plugin to 0.6.2 [#174](https://github.com/storybookjs/presets/pull/174)

## 3.1.4

- Upgrade react-docgen-typescript-plugin to 0.5.x [#158](https://github.com/storybookjs/presets/pull/158)

## 3.1.3

- Move node-logger to peer deps [#156](https://github.com/storybookjs/presets/pull/156)

## 3.1.2

- Restore node@10 compatibility [#154](https://github.com/storybookjs/presets/pull/154)

## 3.1.1

- Fix react-docgen-typescript-plugin deps [#151](https://github.com/storybookjs/presets/pull/151)

## 3.1.0

- Move to react-docgen-typescript-plugin [#149](https://github.com/storybookjs/presets/pull/149)

## 3.0.1

- Ignore default babel Config from Storybook [#147](https://github.com/storybookjs/presets/pull/147)

## 3.0.0

Reverse course on typescript docgen handling [#142](https://github.com/storybookjs/presets/pull/142)

- Add back `react-docgen-typescript-loader` to the preset
- Add compatibility with SB6's main.js `typescript` setting

## 2.1.2

- Make `@storybook/node-logger` dependency less strict [#138](https://github.com/storybookjs/presets/pull/138)

## 2.1.1

- Set PUBLIC_URL if not set [#104](https://github.com/storybookjs/presets/pull/104)

## 2.1.0

- Yarn PNP compatibility [#104](https://github.com/storybookjs/presets/pull/104)

## 2.0.0

- Remove `react-docgen-typescript-loader` from the preset [#103](https://github.com/storybookjs/presets/pull/103)

Starting in `v5.x`, `react-docgen` supports typescript natively, so we no longer recommend `react-docgen-typescript-loader` and have removed it from the preset. This is a breaking change and the migration is documented in [Storybook](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-prop-tables-with-typescript).
