import { expect, it } from 'vitest';

import { tiePreviewRuntimeSetup } from './preview-runtime-entry.ts';

const emitted = `import { n as setup, t as init_runtime } from "./_chunks/runtime-BRZkE5NQ.js";
init_runtime();
export { setup };
`;

it('keeps a top-level init call and runs it again from the exported setup', () => {
  const tied = tiePreviewRuntimeSetup(emitted);

  expect(tied).toBe(`import { t as init_runtime } from "./_chunks/runtime-BRZkE5NQ.js";
init_runtime();
function setup() {
  init_runtime();
}
export { setup };
`);
});

it('rejects an unexpected preview runtime entry', () => {
  expect(() => tiePreviewRuntimeSetup('export const setup = () => {};\n')).toThrow(
    'Unexpected preview runtime entry'
  );
});
