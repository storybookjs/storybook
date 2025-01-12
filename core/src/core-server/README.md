# Storybook Core-server

This package contains common node-side functionality used among the different frameworks (React, RN, Vue 3, Ember, Angular, etc).

It contains:

- CLI arg parsing
- Storybook UI "manager" webpack configuration
- `storybook dev` dev server
- `storybook build` static builder
- presets handling

The "preview" (aka iframe) side is implemented in pluggable builders:

- `@storybook/builder-webpack5`

These builders abstract both the webpack dependencies as well as the various core configurations and loader/plugin dependencies provided out of the box with Storybook.
