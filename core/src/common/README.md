# Storybook Core-Common

Common utilities used across `@storybook/core-server` (manager UI configuration) and `@storybook/builder-webpack{4,5}` (preview configuration).

This is a lot of code extracted for convenience, not because it made sense.

Supporting multiple version of webpack and this duplicating a large portion of code that was never meant to be generic caused this.

At some point we'll refactor this, it's likely a lot of this code is dead or barely used.
