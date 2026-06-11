/**
 * LLM client wrapper around the Anthropic Claude Agent SDK.
 *
 * Exposes a single `judge<T>(prompt, schema)` method that returns a Zod-
 * validated object. Internally drives `query()` from the SDK with a strict
 * "respond JSON only" instruction; the response text is JSON-parsed, fences
 * stripped, then validated.
 *
 * Configured once at startup via `configureLlmClient(config)`; subsequent
 * `getLlmClient()` calls return the same instance. Tests `vi.mock` this
 * module to provide a fake judge.
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
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export function createLlmClient(config: LlmConfig): LlmClient {
  return {
    async judge<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
      const wrapped =
        prompt +
        '\n\nReturn ONLY a JSON object matching the requested schema. ' +
        'No fences, no prose, no comments. Single JSON object.';
      let text = '';
      const response = query({
        prompt: wrapped,
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
