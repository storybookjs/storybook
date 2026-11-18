// The one model call the metric makes.
//
// Streamed rather than awaited whole: max_tokens is high enough that a
// non-streaming request risks an HTTP timeout, and .finalMessage() gives the
// assembled message back anyway.
import Anthropic from '@anthropic-ai/sdk';

import type { buildJudgeRequest } from './context.ts';
import type { JudgeResponse } from './types.ts';

/** Exactly what buildJudgeRequest produces, so no cast is needed at the call site. */
export type JudgeRequest = ReturnType<typeof buildJudgeRequest>;

/**
 * Fail before any work is thrown away, and say where the key goes — the eval
 * suite reads it from .env.local, which is not obvious from an SDK error.
 */
export function assertApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ds-misuse: ANTHROPIC_API_KEY is not set, and the judge cannot run without it. ' +
        'Add it to agent-eval/.env.local (see .env.example) or export it.'
    );
  }
}

/** What one judge call consumed, for the CLI's spend report. */
export interface JudgeUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

/**
 * Call the judge and return its structured answer plus what it consumed.
 *
 * The response is schema-constrained by output_config.format, so the only
 * failures worth naming are the ones that produce no usable content at all.
 */
export async function runJudge(
  request: JudgeRequest
): Promise<{ judged: JudgeResponse; usage: JudgeUsage }> {
  assertApiKey();
  const client = new Anthropic();

  const message = await client.messages.stream(request).finalMessage();

  // A refusal is an HTTP 200 with an empty content array, so it has to be read
  // off stop_reason: reading content[0] first would report it as a parse error.
  if (message.stop_reason === 'refusal') {
    throw new Error(
      `ds-misuse: the judge refused this request (${message.stop_details?.category ?? 'no category'}). ` +
        'Nothing was scored; the run is left unjudged.'
    );
  }
  // Truncation is the other way to get unusable content: the JSON is valid
  // looking right up to where it was cut, so JSON.parse is the wrong reporter.
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      'ds-misuse: the judge hit max_tokens and returned incomplete JSON. ' +
        'Raise MAX_TOKENS in context.ts, or judge a smaller change set.'
    );
  }

  const text = message.content.find((block) => block.type === 'text');
  if (text?.type !== 'text') {
    throw new Error(
      `ds-misuse: the judge returned no text block (stop_reason: ${message.stop_reason}).`
    );
  }

  return {
    judged: JSON.parse(text.text) as JudgeResponse,
    usage: {
      inputTokens: message.usage.input_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      outputTokens: message.usage.output_tokens,
    },
  };
}
