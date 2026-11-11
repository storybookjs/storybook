import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { answerFromLog } from './answer.ts';

const schema = z.object({ n: z.number() });

describe('answerFromLog', () => {
  it('returns the last block when two exist', () => {
    const log = 'a <qa-result>{"n":1}</qa-result> b\n<qa-result>\n{"n":2}\n</qa-result> c';
    expect(answerFromLog(log, schema)).toEqual({ n: 2 });
  });

  it('returns undefined without a block', () => {
    expect(answerFromLog('no answer here', schema)).toBeUndefined();
  });

  it('returns undefined for broken JSON', () => {
    expect(answerFromLog('<qa-result>{"n":</qa-result>', schema)).toBeUndefined();
  });

  it('returns undefined for JSON that fails the schema', () => {
    expect(answerFromLog('<qa-result>{"n":"x"}</qa-result>', schema)).toBeUndefined();
  });
});
