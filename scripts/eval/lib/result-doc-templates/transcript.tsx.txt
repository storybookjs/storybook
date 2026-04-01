import { useEffect, useRef, useState } from 'react';
import type {
	AssistantMessage,
	TranscriptMessage,
	TranscriptProps,
	ResultMessage,
	SystemMessage,
	TextContent,
	ToolResultContent,
	ToolUseContent,
	UserMessage,
} from './transcript.types.ts';

const formatJsonWithPreservedWhitespace = (obj: any): string => {
	return JSON.stringify(obj, null, 2)
		.replace(/\\\\n/g, '\\n')
		.replace(/\\n/g, '\n')
		.replace(/\\\\t/g, '\\t')
		.replace(/\\t/g, '\t');
};

const truncateText = (text: string, maxLength: number): string => {
	return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
};

const getPercentageStyle = (percentage: number): React.CSSProperties => {
	const adjustedPercentage = Math.max(0, percentage - 5);
	const intensity = Math.min(adjustedPercentage / 25, 1);
	const red = Math.round(245 + (248 - 245) * intensity);
	const green = Math.round(245 * (1 - intensity));
	const blue = Math.round(245 * (1 - intensity));
	const bgColor = `rgb(${red}, ${green}, ${blue})`;
	const textColor = intensity > 0.4 ? '#ffffff' : '#666';
	return { background: bgColor, color: textColor };
};

const MetadataCard = ({
	title,
	value,
	subvalue,
	html,
}: {
	title: string;
	value?: string | number;
	subvalue?: string;
	html?: string;
}) => (
	<div
		style={{
			padding: '1.5rem',
			backgroundColor: '#f9fafb',
			border: '1px solid #e5e7eb',
			borderRadius: '8px',
		}}
	>
		<h3
			style={{
				margin: '0 0 0.5rem 0',
				fontSize: '0.875rem',
				fontWeight: 600,
				color: '#6b7280',
				textTransform: 'uppercase',
				letterSpacing: '0.05em',
			}}
		>
			{title}
		</h3>
		{html ? (
			<div dangerouslySetInnerHTML={{ __html: html }} />
		) : (
			<>
				<div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{value}</div>
				{subvalue && (
					<div
						style={{
							fontSize: '0.875rem',
							color: '#6b7280',
							marginTop: '0.25rem',
						}}
					>
						{subvalue}
					</div>
				)}
			</>
		)}
	</div>
);

const CodeBlock = ({
	content,
	language = '',
	isError = false,
}: {
	content: string;
	language?: string;
	isError?: boolean;
}) => {
	const [isTruncated, setIsTruncated] = useState(content.length > 500);
	const codeRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (codeRef.current && (globalThis as any).hljs) {
			(globalThis as any).hljs.highlightElement(codeRef.current);
		}
	}, [content, isTruncated]);

	return (
		<div style={{ position: 'relative', marginBottom: '1rem' }}>
			<pre
				style={{
					margin: 0,
					padding: '1rem',
					backgroundColor: isError ? '#fef2f2' : '#1e1e1e',
					color: isError ? '#991b1b' : '#d4d4d4',
					borderRadius: '6px',
					overflow: isTruncated ? 'hidden' : 'auto',
					fontSize: '0.875rem',
					fontFamily: 'monospace',
					border: isError ? '1px solid #fecaca' : 'none',
					maxHeight: isTruncated ? '300px' : 'none',
					position: 'relative',
					whiteSpace: 'pre-wrap',
					wordBreak: 'break-word',
				}}
			>
				<code ref={codeRef} className={language ? `language-${language}` : ''}>
					{content}
				</code>
				{isTruncated && content.length > 500 && (
					<div
						style={{
							position: 'absolute',
							bottom: 0,
							left: 0,
							right: 0,
							height: '60px',
							background: isError
								? 'linear-gradient(transparent, #fef2f2)'
								: 'linear-gradient(transparent, #1e1e1e)',
							pointerEvents: 'none',
						}}
					/>
				)}
			</pre>
			{content.length > 500 && (
				<button
					onClick={() => setIsTruncated(!isTruncated)}
					style={{
						marginTop: '0.5rem',
						padding: '0.5rem 1rem',
						backgroundColor: '#3b82f6',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '0.875rem',
					}}
				>
					{isTruncated ? 'Show more' : 'Show less'}
				</button>
			)}
		</div>
	);
};

const ContentSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div style={{ marginBottom: '1rem' }}>
		<div
			style={{
				fontSize: '0.75rem',
				fontWeight: 600,
				color: '#6b7280',
				textTransform: 'uppercase',
				letterSpacing: '0.05em',
				marginBottom: '0.5rem',
			}}
		>
			{label}
		</div>
		{children}
	</div>
);

const FileContent = ({
	filePath,
	content,
	language = 'typescript',
}: {
	filePath: string;
	content: string;
	language?: string;
}) => (
	<>
		<ContentSection label="File Path">
			<code
				style={{
					background: '#f9f9f9',
					padding: '0.25rem 0.5rem',
					borderRadius: '4px',
					fontSize: '0.875rem',
					fontFamily: 'monospace',
				}}
			>
				{filePath}
			</code>
		</ContentSection>
		<ContentSection label="Content">
			<CodeBlock content={content} language={language} />
		</ContentSection>
	</>
);

const FileDiff = ({
	filePath,
	oldString,
	newString,
}: {
	filePath: string;
	oldString: string;
	newString: string;
}) => {
	const diff = `--- a/${filePath}
+++ b/${filePath}
@@ -1,${oldString.split('\n').length} +1,${newString.split('\n').length} @@
${oldString
	.split('\n')
	.map((line) => '-' + line)
	.join('\n')}
${newString
	.split('\n')
	.map((line) => '+' + line)
	.join('\n')}`;

	return (
		<>
			<ContentSection label="File Path">
				<code
					style={{
						background: '#f9f9f9',
						padding: '0.25rem 0.5rem',
						borderRadius: '4px',
						fontSize: '0.875rem',
						fontFamily: 'monospace',
					}}
				>
					{filePath}
				</code>
			</ContentSection>
			<ContentSection label="Diff">
				<CodeBlock content={diff} language="diff" />
			</ContentSection>
		</>
	);
};

const TodoList = ({ todos }: { todos: Array<{ content: string; status?: string }> }) => (
	<div style={{ padding: '1rem' }}>
		{todos.map((todo, i) => {
			const status = todo.status || 'pending';
			const checked = status === 'completed';
			const indeterminate = status === 'in_progress';

			return (
				<div
					key={i}
					style={{
						display: 'flex',
						alignItems: 'center',
						padding: '0.5rem 0',
					}}
				>
					<input
						type="checkbox"
						checked={checked}
						ref={(el) => {
							if (el) el.indeterminate = indeterminate;
						}}
						readOnly
						style={{ marginRight: '0.5rem' }}
					/>
					<span>{todo.content}</span>
				</div>
			);
		})}
	</div>
);

const ElapsedTime = ({ elapsedMs, percentage }: { elapsedMs: number; percentage: number }) => (
	<div
		style={{
			display: 'flex',
			justifyContent: 'center',
			margin: '1rem 0',
		}}
	>
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '0.5rem',
				padding: '0.5rem 1rem',
				backgroundColor: '#f9fafb',
				borderRadius: '4px',
				fontSize: '0.875rem',
				color: '#6b7280',
			}}
		>
			<span>{(elapsedMs / 1000).toFixed(1)}s</span>
			<span
				style={{
					...getPercentageStyle(percentage),
					padding: '0.125rem 0.5rem',
					borderRadius: '9999px',
					fontSize: '0.75rem',
					fontWeight: 600,
				}}
			>
				{percentage.toFixed(1)}%
			</span>
		</div>
	</div>
);

const TYPE_COLORS = {
	assistant: { bg: '#dbeafe', text: '#1e40af' },
	user: { bg: '#f3e8ff', text: '#6b21a8' },
	system: { bg: '#e0e7ff', text: '#3730a3' },
	result: { bg: '#dcfce7', text: '#166534' },
	tool: { bg: '#fef3c7', text: '#92400e' },
	prompt: { bg: '#fce7f3', text: '#9f1239' },
} as const;

const Turn = ({
	children,
	type,
	title,
	subtitle,
	tokenCount,
	percentage,
	isMCP = false,
}: {
	children: React.ReactNode;
	type: keyof typeof TYPE_COLORS;
	title: string;
	subtitle?: string;
	tokenCount?: string;
	percentage?: number;
	isMCP?: boolean;
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const colors = TYPE_COLORS[type] ?? TYPE_COLORS.assistant;

	return (
		<div
			style={{
				marginBottom: '1rem',
				border: isMCP ? '2px solid #06b6d4' : '1px solid #e5e7eb',
				borderRadius: '8px',
				overflow: 'hidden',
			}}
		>
			<div
				onClick={() => setIsExpanded(!isExpanded)}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '0.75rem',
					padding: '1rem',
					backgroundColor: '#f9fafb',
					cursor: 'pointer',
					userSelect: 'none',
				}}
			>
				<div
					style={{
						transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
						transition: 'transform 0.2s',
						fontSize: '0.75rem',
					}}
				>
					▶
				</div>
				<span
					style={{
						padding: '0.25rem 0.75rem',
						borderRadius: '4px',
						fontSize: '0.75rem',
						fontWeight: 600,
						backgroundColor: colors.bg,
						color: colors.text,
						textTransform: 'uppercase',
					}}
				>
					{type}
				</span>
				{isMCP && (
					<span
						style={{
							padding: '0.25rem 0.5rem',
							borderRadius: '4px',
							fontSize: '0.75rem',
							fontWeight: 600,
							backgroundColor: '#06b6d4',
							color: 'white',
						}}
					>
						MCP
					</span>
				)}
				<span style={{ fontWeight: 600 }}>{title}</span>
				{subtitle && (
					<span
						style={{
							color: '#6b7280',
							fontSize: '0.875rem',
							fontFamily: 'monospace',
							flex: 1,
						}}
					>
						{subtitle}
					</span>
				)}
				{!subtitle && <span style={{ flex: 1 }} />}
				{tokenCount && (
					<>
						<span style={{ flex: 1 }} />
						<span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{tokenCount}</span>
						{percentage !== undefined && (
							<span
								style={{
									...getPercentageStyle(percentage),
									padding: '0.125rem 0.5rem',
									borderRadius: '9999px',
									fontSize: '0.75rem',
									fontWeight: 600,
								}}
							>
								{percentage.toFixed(1)}%
							</span>
						)}
					</>
				)}
			</div>
			{isExpanded && <div style={{ padding: '1rem', backgroundColor: 'white' }}>{children}</div>}
		</div>
	);
};

export const Transcript = (props: TranscriptProps) => {
	const { prompt, promptTokenCount, messages } = props;

	useEffect(() => {
		const script = document.createElement('script');
		script.type = 'module';
		script.textContent = `import hljs from 'https://esm.sh/highlight.js@11.9.0'; window.hljs = hljs;`;
		document.head.appendChild(script);

		const style = document.createElement('link');
		style.rel = 'stylesheet';
		style.href = 'https://esm.sh/highlight.js@11.9.0/styles/github-dark-dimmed.css';
		document.head.appendChild(style);

		const codeStyle = document.createElement('style');
		codeStyle.textContent = 'code * { font-family: monospace !important; }';
		document.head.appendChild(codeStyle);

		return () => {
			document.head.removeChild(script);
			document.head.removeChild(style);
			document.head.removeChild(codeStyle);
		};
	}, []);

	const systemTurn = messages.find((t) => t.type === 'system') as SystemMessage | undefined;
	const resultTurn = messages.find((t) => t.type === 'result') as ResultMessage | undefined;

	const messageTokens = messages.reduce((sum, turn) => sum + (turn.tokenCount || 0), 0);

	const totalTime = messages.reduce((sum, turn) => sum + (turn.ms || 0), 0);
	const totalMessageTokens = messageTokens;

	const metadataCards = [];

	if (systemTurn) {
		metadataCards.push({
			title: 'Agent',
			value: systemTurn.agent || 'N/A',
		});

		metadataCards.push({
			title: 'Model',
			value: systemTurn.model || 'N/A',
		});

		if (systemTurn.tools) {
			const mcpTools = systemTurn.tools.filter((t) => t.includes('mcp'));
			metadataCards.push({
				title: 'Available Tools',
				value: systemTurn.tools.length,
				subvalue: mcpTools.length > 0 ? `${mcpTools.length} MCP tools` : 'unknown',
			});
		}

		if (systemTurn.mcp_servers && systemTurn.mcp_servers.length > 0) {
			const mcpServersHtml =
				'<div style="display: flex; flex-wrap: wrap;">' +
				systemTurn.mcp_servers
					.map(
						(s) =>
							`<div style="display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; background-color: #f3f4f6; border-radius: 9999px; font-size: 0.875rem; margin-right: 0.5rem; margin-bottom: 0.5rem;">
								<span title="${s.status}" style="width: 8px; height: 8px; border-radius: 50%; background-color: ${s.status === 'connected' ? '#10b981' : s.status === 'unknown' ? '#6b7280' : '#ef4444'}; margin-right: 0.5rem;"></span>
								${s.name}
							</div>`,
					)
					.join('') +
				'</div>';
			metadataCards.push({
				title: 'MCP Servers',
				html: mcpServersHtml,
			});
		} else {
			metadataCards.push({
				title: 'MCP Servers',
				value: 'None',
			});
		}
	}

	if (resultTurn) {
		if (resultTurn.num_turns !== undefined) {
			metadataCards.push({
				title: 'Turns',
				value: resultTurn.num_turns,
			});
		}

		if (messageTokens > 0) {
			metadataCards.push({
				title: 'Total Message Tokens',
				value: messageTokens.toLocaleString(),
			});
		}
	}

	const turns = messages.filter((t) => ['assistant', 'user', 'system', 'result'].includes(t.type));

	const groupedTurns = groupToolCallsWithResults(turns);

	return (
		<div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
			<h1 style={{ marginTop: 0 }}>Agent Transcript</h1>

			{metadataCards.length > 0 && (
				<div style={{ marginBottom: '2rem' }}>
					<h2
						style={{
							fontSize: '1.125rem',
							fontWeight: 600,
							marginBottom: '1rem',
						}}
					>
						Metadata
					</h2>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
							gap: '1rem',
						}}
					>
						{metadataCards.map((card, index) => (
							<MetadataCard key={index} {...card} />
						))}
					</div>
				</div>
			)}

			<h2
				style={{
					fontSize: '1.125rem',
					fontWeight: 600,
					marginBottom: '1rem',
				}}
			>
				Turns
			</h2>

			{prompt && (
				<Turn
					type="prompt"
					title="User Prompt"
					tokenCount={`${promptTokenCount.toLocaleString()} tokens`}
					percentage={(promptTokenCount / totalMessageTokens) * 100}
				>
					<ContentSection label="Prompt">
						<CodeBlock content={prompt} language="markdown" />
					</ContentSection>
				</Turn>
			)}

			{groupedTurns.map((group, index) => {
				const isTodoWrite =
					group.toolCall &&
					'message' in group.toolCall &&
					group.toolCall.message?.content?.find(
						(c) => c.type === 'tool_use' && c.name === 'TodoWrite',
					);

				if (isTodoWrite && 'input' in isTodoWrite && isTodoWrite.input?.todos) {
					return <TodoList key={index} todos={isTodoWrite.input.todos} />;
				}

				const elements = [];

				if (index > 0) {
					const currentTurn = group.toolCall || group.turn;
					if (currentTurn) {
						const elapsedMs = currentTurn.ms;
						if (elapsedMs >= 50) {
							const percentage = (elapsedMs / totalTime) * 100;
							elements.push(
								<ElapsedTime
									key={`elapsed-${index}`}
									elapsedMs={elapsedMs}
									percentage={percentage}
								/>,
							);
						}
					}
				}

				if (group.toolCall && group.toolResult) {
					elements.push(
						<ToolCallGroup
							key={`tool-${index}`}
							toolCall={group.toolCall as AssistantMessage}
							toolResult={group.toolResult as UserMessage}
							totalMessageTokens={totalMessageTokens}
							cwd={systemTurn?.cwd || ''}
						/>,
					);
				} else if (group.turn) {
					elements.push(
						<TurnRenderer
							key={`turn-${index}`}
							turn={group.turn}
							totalMessageTokens={totalMessageTokens}
						/>,
					);
				}

				return elements;
			})}
		</div>
	);
};

function groupToolCallsWithResults(turns: TranscriptMessage[]): Array<{
	toolCall?: TranscriptMessage;
	toolResult?: TranscriptMessage;
	turn?: TranscriptMessage;
}> {
	const grouped: Array<{
		toolCall?: TranscriptMessage;
		toolResult?: TranscriptMessage;
		turn?: TranscriptMessage;
	}> = [];
	const usedResultIndices = new Set<number>();

	for (const [i, turn] of turns.entries()) {
		if (usedResultIndices.has(i)) continue;

		const toolUseContent =
			turn.type === 'assistant' &&
			'message' in turn &&
			turn.message?.content?.find((c) => c.type === 'tool_use');

		if (toolUseContent && 'id' in toolUseContent) {
			const toolUseId = toolUseContent.id;
			const resultIndex = turns.findIndex(
				(t, j) =>
					j > i &&
					t.type === 'user' &&
					'message' in t &&
					t.message?.content?.some(
						(c) => c.type === 'tool_result' && 'tool_use_id' in c && c.tool_use_id === toolUseId,
					),
			);

			if (resultIndex !== -1) {
				grouped.push({ toolCall: turn, toolResult: turns[resultIndex] });
				usedResultIndices.add(resultIndex);
				continue;
			}
		}

		grouped.push({ turn });
	}

	return grouped;
}

const ToolCallGroup = ({
	toolCall,
	toolResult,
	totalMessageTokens,
	cwd,
}: {
	toolCall: AssistantMessage;
	toolResult: UserMessage;
	totalMessageTokens: number;
	cwd: string;
}) => {
	const toolUse = toolCall.message.content.find((c) => c.type === 'tool_use') as ToolUseContent;
	const toolName = toolUse?.name || 'Unknown Tool';
	const isMCP = toolUse?.isMCP;

	const additionalInfo = extractToolAdditionalInfo(toolUse, toolName, cwd);

	const totalTokens = (toolCall.tokenCount || 0) + (toolResult.tokenCount || 0);
	const percentage = totalMessageTokens > 0 ? (totalTokens / totalMessageTokens) * 100 : 0;

	const tokenCountStr =
		toolCall.tokenCount && toolResult.tokenCount
			? `${toolCall.tokenCount.toLocaleString()} + ${toolResult.tokenCount.toLocaleString()} tokens`
			: `${totalTokens.toLocaleString()} tokens`;

	return (
		<Turn
			type="tool"
			title={toolName}
			subtitle={additionalInfo}
			tokenCount={tokenCountStr}
			percentage={percentage}
			isMCP={isMCP}
		>
			{renderToolInput(toolUse, toolName)}
			{renderToolOutput(toolResult, isMCP)}
		</Turn>
	);
};

const TurnRenderer = ({
	turn,
	totalMessageTokens,
}: {
	turn: TranscriptMessage;
	totalMessageTokens: number;
}) => {
	const isMCP =
		turn.type === 'assistant' &&
		'message' in turn &&
		turn.message?.content?.some((c) => c.type === 'tool_use' && c.isMCP);

	const title = getTurnTitle(turn);
	const percentage =
		turn.tokenCount && totalMessageTokens > 0 ? (turn.tokenCount / totalMessageTokens) * 100 : 0;

	return (
		<Turn
			type={turn.type}
			title={title}
			tokenCount={turn.tokenCount ? `${turn.tokenCount.toLocaleString()} tokens` : undefined}
			percentage={turn.tokenCount ? percentage : undefined}
			isMCP={isMCP}
		>
			{'message' in turn && turn.message?.content
				? renderTurnContent(turn.message.content)
				: renderSystemOrResult(turn)}
		</Turn>
	);
};

function getTurnTitle(turn: TranscriptMessage): string {
	if (turn.type === 'assistant' && 'message' in turn && turn.message?.content) {
		const toolUse = turn.message.content.find((c) => c.type === 'tool_use');
		if (toolUse && 'name' in toolUse) return toolUse.name;

		const text = turn.message.content.find((c) => c.type === 'text');
		if (text && 'text' in text) return truncateText(text.text, 80);
	}

	if (turn.type === 'user' && 'message' in turn && turn.message?.content) {
		const toolResult = turn.message.content.find((c) => c.type === 'tool_result');
		if (toolResult && 'tool_use_id' in toolResult) return `Result: ${toolResult.tool_use_id}`;
	}

	return 'subtype' in turn && turn.subtype ? turn.subtype : turn.type;
}

function extractToolAdditionalInfo(
	toolUse: ToolUseContent | undefined,
	toolName: string,
	cwd: string,
): string {
	if (!toolUse?.input) return '';

	if (['Read', 'Write', 'Edit'].includes(toolName)) {
		const fullPath = toolUse.input.file_path || toolUse.input.path;
		if (fullPath) {
			return cwd && fullPath.startsWith(cwd)
				? fullPath.substring(cwd.length).replace(/^\//, '')
				: fullPath;
		}
	}

	if (toolName === 'Glob' && toolUse.input.pattern) {
		return toolUse.input.pattern;
	}

	if (toolName === 'Bash' && toolUse.input.command) {
		const cmd = toolUse.input.command;
		return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
	}

	return '';
}

function renderToolInput(toolUse: ToolUseContent | undefined, toolName: string): React.ReactNode {
	if (!toolUse?.input) return null;

	if (toolName === 'Write' && toolUse.input.file_path && toolUse.input.content) {
		return (
			<FileContent
				filePath={toolUse.input.file_path}
				content={toolUse.input.content}
				language="typescript"
			/>
		);
	}

	if (
		toolName === 'Edit' &&
		toolUse.input.file_path &&
		toolUse.input.old_string &&
		toolUse.input.new_string
	) {
		return (
			<FileDiff
				filePath={toolUse.input.file_path}
				oldString={toolUse.input.old_string}
				newString={toolUse.input.new_string}
			/>
		);
	}

	return (
		<ContentSection label="Input">
			<CodeBlock content={formatJsonWithPreservedWhitespace(toolUse.input)} />
		</ContentSection>
	);
}

function renderToolOutput(toolResult: UserMessage, isMCP: boolean): React.ReactNode {
	const toolResultContent = toolResult.message.content.find((c) => c.type === 'tool_result');
	if (!toolResultContent) return null;

	if (isMCP) {
		try {
			const content =
				typeof toolResultContent.content === 'string'
					? JSON.parse(toolResultContent.content)
					: toolResultContent.content;

			if (Array.isArray(content)) {
				return (
					<ContentSection label="Output">
						<>
							{content.map((item, index) => {
								if (item.type !== 'text' || !item.text) return null;
								return <CodeBlock key={index} content={item.text} isError={item.isError} />;
							})}
						</>
					</ContentSection>
				);
			}
		} catch {
			// Fall through to default rendering
		}
	}

	return (
		<ContentSection label="Output">
			<CodeBlock
				content={
					typeof toolResultContent.content === 'string'
						? toolResultContent.content
						: JSON.stringify(toolResultContent.content, null, 2)
				}
			/>
		</ContentSection>
	);
}

function renderTurnContent(
	content: (TextContent | ToolUseContent | ToolResultContent)[],
): React.ReactNode {
	return (
		<>
			{content.map((item, index) => {
				if (item.type === 'text' && 'text' in item) {
					return (
						<ContentSection key={index} label="Text">
							<CodeBlock content={item.text} language="markdown" />
						</ContentSection>
					);
				}
				if (item.type === 'tool_use' && 'name' in item) {
					return (
						<div key={index}>
							<ContentSection label="Tool">
								<code
									style={{
										background: '#f9f9f9',
										padding: '0.25rem 0.5rem',
										borderRadius: '4px',
										fontSize: '0.875rem',
										fontFamily: 'monospace',
									}}
								>
									{item.name}
								</code>
							</ContentSection>
							{'input' in item && item.input && (
								<ContentSection label="Input">
									<CodeBlock content={formatJsonWithPreservedWhitespace(item.input)} />
								</ContentSection>
							)}
						</div>
					);
				}
				if (item.type === 'tool_result' && 'content' in item) {
					return (
						<ContentSection key={index} label="Result">
							<CodeBlock
								content={
									typeof item.content === 'string'
										? item.content
										: JSON.stringify(item.content, null, 2)
								}
							/>
						</ContentSection>
					);
				}
				return null;
			})}
		</>
	);
}

function renderSystemOrResult(turn: TranscriptMessage): React.ReactNode {
	const data = { ...turn };
	delete (data as any).type;
	delete (data as any).ms;
	delete (data as any).uuid;
	delete (data as any).session_id;
	delete (data as any).parent_tool_use_id;
	delete (data as any).tokenCount;
	delete (data as any).costUSD;

	return (
		<ContentSection label="Data">
			<CodeBlock content={formatJsonWithPreservedWhitespace(data)} />
		</ContentSection>
	);
}
