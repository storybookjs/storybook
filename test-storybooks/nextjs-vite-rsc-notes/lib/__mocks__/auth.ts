import { fn } from "storybook/test";

// What `sb.mock()` in .storybook/preview.ts takes for `#lib/auth.ts`. Better
// Auth itself does not run: a story says what an API answers, like
// `mocked(auth.api.listPasskeys).mockResolvedValue([...])`.
export const auth = {
  api: {
    deletePasskey: fn(),
    listPasskeys: fn(async () => []),
    signInEmail: fn(),
    signInMagicLink: fn(),
    signOut: fn(),
    signUpEmail: fn(),
  },
};
