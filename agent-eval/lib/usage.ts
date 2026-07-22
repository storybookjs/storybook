/**
 * @see https://vercel.com/docs/ai-gateway/pricing
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
	/** @see https://platform.claude.com/docs/en/pricing */
	'claude-opus-4-8': { input: 5, output: 25 },
	/** @see https://platform.claude.com/docs/en/pricing */
	'claude-opus-4-7': { input: 5, output: 25 },
	/** @see https://platform.claude.com/docs/en/pricing */
	'claude-sonnet-5': { input: 3, output: 15 },
	/** @see https://platform.claude.com/docs/en/pricing */
	'claude-haiku-4-5': { input: 1, output: 5 },
	/**
	 * @see https://developers.openai.com/api/docs/pricing
	 */
	'gpt-5.5': { input: 5, output: 30 },
	/**
	 * @see https://developers.openai.com/api/docs/pricing
	 */
	'gpt-5.4': { input: 2.5, output: 15 },
};

export interface TranscriptUsage {
	inputTokens: number;
	cacheWriteTokens: number;
	cacheReadTokens: number;
	outputTokens: number;
	totalTokens: number;
	/** Estimated from MODEL_PRICING; undefined when the model's pricing is unknown. */
	estimatedCostUsd?: number;
}

import { isRecord } from './shell-parse.ts';

function parseJsonLines(raw: string): Record<string, unknown>[] {
	return raw.split('\n').flatMap((line) => {
		try {
			const parsed = JSON.parse(line) as unknown;
			return isRecord(parsed) ? [parsed] : [];
		} catch {
			return [];
		}
	});
}

function toTokenCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Aggregates token usage from a raw agent transcript. Claude Code session
 * transcripts repeat usage across streamed assistant events, so those are
 * deduplicated by message id; Codex transcripts report per-turn usage on
 * turn.completed events.
 */
export function collectTranscriptUsage(
	rawTranscript: string,
	model?: string,
): TranscriptUsage | undefined {
	const usage = { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
	const seenMessages = new Set<string>();

	for (const event of parseJsonLines(rawTranscript)) {
		// Claude Code session transcript: streamed assistant events with usage.
		if (event.type === 'assistant' && isRecord(event.message) && isRecord(event.message.usage)) {
			const message = event.message;
			const messageUsage = event.message.usage;
			if (typeof message.id === 'string' && seenMessages.has(message.id)) {
				continue;
			}

			if (typeof message.id === 'string') {
				seenMessages.add(message.id);
			}
			usage.inputTokens += toTokenCount(messageUsage.input_tokens);
			usage.cacheWriteTokens += toTokenCount(messageUsage.cache_creation_input_tokens);
			usage.cacheReadTokens += toTokenCount(messageUsage.cache_read_input_tokens);
			usage.outputTokens += toTokenCount(messageUsage.output_tokens);
		}
		// Codex transcript: per-turn usage on turn.completed events.
		else if (event.type === 'turn.completed' && isRecord(event.usage)) {
			const turnUsage = event.usage;
			const cached = toTokenCount(turnUsage.cached_input_tokens);
			usage.cacheReadTokens += cached;
			// input_tokens includes the cached portion; clamp in case a transcript
			// reports cached tokens without (or exceeding) input_tokens.
			usage.inputTokens += Math.max(0, toTokenCount(turnUsage.input_tokens) - cached);
			usage.outputTokens += toTokenCount(turnUsage.output_tokens);
		}
	}

	const totalTokens =
		usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens + usage.outputTokens;

	if (totalTokens === 0) {
		return undefined;
	}

	const pricing = model ? MODEL_PRICING[model] : undefined;
	const estimatedCostUsd = pricing
		? (usage.inputTokens * pricing.input +
				usage.cacheWriteTokens * pricing.input * 1.25 +
				usage.cacheReadTokens * pricing.input * 0.1 +
				usage.outputTokens * pricing.output) /
			1_000_000
		: undefined;

	return { ...usage, totalTokens, estimatedCostUsd };
}
