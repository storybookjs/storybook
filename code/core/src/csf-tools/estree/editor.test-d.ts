import { it } from 'vitest';

import { SourceEditor } from './editor.ts';

it('keeps the parse, the pending batch and the running transaction of an editor private', () => {
  const editor = new SourceEditor('export default {};');
  // @ts-expect-error: private to SourceEditor
  void editor._module;
  // @ts-expect-error: private to SourceEditor
  void editor._batch;
  // @ts-expect-error: private to SourceEditor
  void editor._transaction;
});
