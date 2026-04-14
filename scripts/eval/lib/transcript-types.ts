export interface TextContent {
	type: 'text';
	text: string;
}

export interface ToolUseContent {
	type: 'tool_use';
	id: string;
	name: string;
	input: Record<string, any>;
	isMCP: boolean;
}

export interface ToolResultContent {
	tool_use_id: string;
	type: 'tool_result';
	content: string | Array<{ type: string; text?: string; isError?: boolean }>;
}

export interface MessageUsage {
	input_tokens: number;
	output_tokens: number;
}

export interface AssistantMessage {
	type: 'assistant';
	message: {
		content: (TextContent | ToolUseContent)[];
		usage: MessageUsage;
	};
	ms: number;
	tokenCount?: number;
	costUSD?: number;
}

export interface UserMessage {
	type: 'user';
	message: {
		content: ToolResultContent[];
	};
	ms: number;
	tokenCount?: number;
	costUSD?: number;
}

export interface SystemMessage {
	type: 'system';
	subtype: 'init';
	agent: string;
	model: string;
	tools: string[];
	mcp_servers: Array<{
		name: string;
		status: 'connected' | 'disconnected' | 'unknown';
	}>;
	cwd: string;
	ms: number;
	tokenCount?: number;
	costUSD?: number;
}

export interface ResultMessage {
	type: 'result';
	subtype: 'success' | 'error';
	duration_ms: number;
	duration_api_ms: number;
	num_turns: number;
	total_cost_usd: number;
	ms: number;
	tokenCount?: number;
	costUSD?: number;
}

export type TranscriptMessage = AssistantMessage | UserMessage | SystemMessage | ResultMessage;

export interface TranscriptProps {
	prompt: string;
	promptTokenCount: number;
	promptCost: number;
	messages: TranscriptMessage[];
}
