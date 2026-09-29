/**
 * This is a replacement for next/dist/compiled/safe-stable-stringify
 *
 * Because it is CJS and needs access to __dirname, which causes Storybook to break.
 *
 * Original file can be found here:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/compiled/safe-stable-stringify/index.js
 */
export default function safeStableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
