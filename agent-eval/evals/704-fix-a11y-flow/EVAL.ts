// Sanity gate, not measurement: a dead or transcript-less run fails instead of
// reporting success. Real measurement is offline; see lib/agentic-reference/post-analysis.ts.
import { expect, test } from 'vitest';
import { getTranscript } from '#test-utils';

test('agent produced a transcript', () => {
  const transcript = getTranscript();
  expect(transcript.events.length, 'Expected the transcript to contain events').toBeGreaterThan(0);
});
