/* eslint-disable @typescript-eslint/no-explicit-any */
import { testTransform } from 'storybook/internal/csf-tools';

/** This transforms the test function of a story into another story */
export async function storybookTestFn(): Promise<any> {
  // export async function storybookTestFn(): Promise<Plugin> {
  const storiesRegex = /\.stories\.(tsx?|jsx?)$/;

  return {
    name: 'storybook:test-function',
    enforce: 'post',
    async transform(src: any, id: any) {
      if (!storiesRegex.test(id)) {
        return undefined;
      }

      const result = await testTransform({
        code: src,
        fileName: id,
      });
      return result;
    },
  };
}
