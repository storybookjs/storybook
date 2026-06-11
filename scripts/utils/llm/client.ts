/**
 * LLM client wrapper around the Anthropic Claude Agent SDK.
 *
 * Two output modes:
 *   - `judge(prompt, schema)` — for structured output with multiple fields.
 *     Wraps the prompt with a "JSON only" instruction, parses the response as
 *     JSON, and validates against a Zod schema.
 *   - `judgeText(prompt)` — for free-form text/markdown output. Returns the
 *     raw assistant text untouched. Use this when the prompt asks for one
 *     blob of prose (e.g. a PR review body); forcing JSON in that case both
 *     wastes tokens and makes life unnecessarily hard for the model.
 *
 * Configured once at startup via `configureLlmClient(config)`; subsequent
 * `getLlmClient()` calls return the same instance. Tests `vi.mock` this
 * module to provide fakes for `judge` / `judgeText`.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ZodSchema } from 'zod';

export type Model = 'sonnet-4.6' | 'opus-4.6' | 'haiku-4.5';
export type Effort = 'low' | 'medium' | 'high' | 'max';

const MODEL_IDS: Record<Model, string> = {
  'sonnet-4.6': 'claude-sonnet-4-6',
  'opus-4.6': 'claude-opus-4-6',
  'haiku-4.5': 'claude-haiku-4-5',
};

export interface LlmConfig {
  model: Model;
  effort: Effort;
  verbose: boolean;
}

export interface LlmClient {
  judge<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;
  judgeText(prompt: string): Promise<string>;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export function createLlmClient(config: LlmConfig): LlmClient {
  async function run(prompt: string): Promise<string> {
    let text = '';
    const response = query({
      prompt,
      options: {
        model: MODEL_IDS[config.model],
        effort: config.effort,
        allowedTools: [],
        settingSources: [],
        permissionMode: 'default',
      },
    });
    for await (const message of response) {
      if (config.verbose) {
        console.log(`[llm] ${message.type}`);
      }
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            text += block.text;
          }
        }
      }
      if (message.type === 'result') break;
    }
    return text;
  }

  return {
    async judge<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
      const wrapped =
        prompt +
        '\n\nReturn ONLY a JSON object matching the requested schema. ' +
        'No fences, no prose, no comments. Single JSON object.';
      const text = await run(wrapped);
      const cleaned = extractJson(text);
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`LLM did not return valid JSON: ${msg}. Raw: ${text.slice(0, 200)}`);
      }
      return schema.parse(parsed);
    },

    async judgeText(prompt: string): Promise<string> {
      return run(prompt);
    },
  };
}

let _client: LlmClient | null = null;

export function configureLlmClient(config: LlmConfig): LlmClient {
  _client = createLlmClient(config);
  return _client;
}

export function getLlmClient(): LlmClient {
  if (!_client) {
    throw new Error('LLM client not configured. Call configureLlmClient(config) at startup.');
  }
  return _client;
}

export function resetLlmClient(): void {
  _client = null;
}
