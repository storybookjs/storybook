// Fixture stories type their CSF against these instead of '@storybook/angular-vite':
// the package root resolves to angular-vite's full client source (via the `code`
// exports condition), which is authored under `strict: false` and cannot join this
// package's strict vue-tsc program. public-types.ts and its type-only graph can.
export type {
  Meta,
  StoryObj,
} from '../../../../frameworks/angular-vite/src/client/public-types.ts';
