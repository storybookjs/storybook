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

function parseJsonLines(raw: string): Record<string, any>[] {
	return raw.split('\n').flatMap((line) => {
		try {
			return [JSON.parse(line)];
		} catch {
			return [];
		}
	});
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
		if (event.type === 'assistant' && event.message?.usage) {
			if (event.message.id && seenMessages.has(event.message.id)) {
				continue;
			}

			seenMessages.add(event.message.id);
			usage.inputTokens += event.message.usage.input_tokens ?? 0;
			usage.cacheWriteTokens += event.message.usage.cache_creation_input_tokens ?? 0;
			usage.cacheReadTokens += event.message.usage.cache_read_input_tokens ?? 0;
			usage.outputTokens += event.message.usage.output_tokens ?? 0;
		} else if (event.type === 'turn.completed' && event.usage) {
			const cached = event.usage.cached_input_tokens ?? 0;
			usage.cacheReadTokens += cached;
			usage.inputTokens += (event.usage.input_tokens ?? 0) - cached;
			usage.outputTokens += event.usage.output_tokens ?? 0;
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
