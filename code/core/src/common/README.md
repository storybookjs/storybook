# Storybook Core-Common

Common Node utilities, exported as `@storybook/core/internal/common` and `storybook/internal/common`.
They are used across the `storybook` server and CLI, the manager builder in `@storybook/manager`, and the preview builders (`@storybook/builder-vite`, `@storybook/builder-webpack5`).

This is a lot of code extracted for convenience, not because it made sense.

Supporting multiple version of webpack and this duplicating a large portion of code that was never meant to be generic caused this.

At some point we'll refactor this, it's likely a lot of this code is dead or barely used.
