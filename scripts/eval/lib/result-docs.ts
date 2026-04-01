import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type TranscriptTurnType =
  | 'prompt'
  | 'system'
  | 'assistant'
  | 'tool'
  | 'user'
  | 'result'
  | 'reasoning'
  | 'command'
  | 'file'
  | 'error';

export interface TranscriptViewTurn {
  id: string;
  type: TranscriptTurnType;
  title: string;
  subtitle?: string;
  content?: string;
  language?: string;
  tokenCount?: number;
  isError?: boolean;
}

export interface TranscriptViewData {
  prompt: string;
  turns: TranscriptViewTurn[];
}

export async function writeEvalResultDocs(resultsDir: string) {
  const [prompt, transcript, summary] = await Promise.all([
    readOptionalText(join(resultsDir, 'prompt.md')),
    readOptionalJson(join(resultsDir, 'transcript.json')),
    readOptionalJson(join(resultsDir, 'summary.json')),
  ]);
  const transcriptViewData = normalizeTranscriptForDocs({
    prompt: prompt ?? '',
    transcript: transcript ?? [],
  });

  await Promise.all([
    writeFile(join(resultsDir, 'summary.mdx'), createSummaryMdx()),
    writeFile(join(resultsDir, 'transcript-view.tsx'), createTranscriptViewComponent()),
    writeFile(
      join(resultsDir, 'transcript-view-data.json'),
      JSON.stringify(transcriptViewData, null, 2)
    ),
    writeFile(join(resultsDir, 'transcript.mdx'), createTranscriptMdx()),
    summary
      ? writeFile(join(resultsDir, 'summary.pretty.json'), JSON.stringify(summary, null, 2))
      : Promise.resolve(),
  ]);
}

export function normalizeTranscriptForDocs(opts: {
  prompt: string;
  transcript: unknown[];
}): TranscriptViewData {
  const turns: TranscriptViewTurn[] = [];

  if (opts.prompt.trim()) {
    turns.push({
      id: 'prompt',
      type: 'prompt',
      title: 'Prompt',
      content: opts.prompt.trim(),
      language: 'markdown',
    });
  }

  for (const [index, entry] of opts.transcript.entries()) {
    turns.push(...normalizeTranscriptEntry(entry, index));
  }

  return {
    prompt: opts.prompt,
    turns,
  };
}

function normalizeTranscriptEntry(entry: unknown, index: number): TranscriptViewTurn[] {
  if (!entry || typeof entry !== 'object') {
    return [];
  }

  if (looksLikeClaudeSystem(entry)) {
    return [
      {
        id: `turn-${index}-system`,
        type: 'system',
        title: 'Session started',
        subtitle: entry.model,
        content: [
          entry.agent ? `Agent: ${entry.agent}` : undefined,
          entry.cwd ? `CWD: ${entry.cwd}` : undefined,
          Array.isArray(entry.tools) ? `Tools: ${entry.tools.join(', ')}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];
  }

  if (looksLikeClaudeAssistant(entry)) {
    return normalizeClaudeAssistant(entry, index);
  }

  if (looksLikeClaudeUser(entry)) {
    return normalizeClaudeUser(entry, index);
  }

  if (looksLikeClaudeResult(entry)) {
    return [
      {
        id: `turn-${index}-result`,
        type: entry.subtype === 'success' ? 'result' : 'error',
        title: entry.subtype === 'success' ? 'Completed' : 'Failed',
        content:
          entry.subtype === 'success'
            ? [
                typeof entry.num_turns === 'number' ? `Turns: ${entry.num_turns}` : undefined,
                typeof entry.total_cost_usd === 'number'
                  ? `Cost: $${entry.total_cost_usd.toFixed(4)}`
                  : undefined,
                typeof entry.duration_ms === 'number'
                  ? `Duration: ${(entry.duration_ms / 1000).toFixed(1)}s`
                  : undefined,
              ]
                .filter(Boolean)
                .join('\n')
            : (entry.errors ?? []).join('\n'),
        isError: entry.subtype !== 'success',
      },
    ];
  }

  if (looksLikeCodexAgentMessage(entry)) {
    return [
      {
        id: `turn-${index}-assistant`,
        type: 'assistant',
        title: 'Assistant',
        content: entry.text,
      },
    ];
  }

  if (looksLikeCodexReasoning(entry)) {
    return [
      {
        id: `turn-${index}-reasoning`,
        type: 'reasoning',
        title: 'Reasoning',
        content: entry.text,
      },
    ];
  }

  if (looksLikeCodexCommand(entry)) {
    return [
      {
        id: `turn-${index}-command`,
        type: 'command',
        title: entry.command,
        subtitle: `exit ${entry.exit_code ?? '?'}`,
        content: entry.aggregated_output || entry.command,
        language: 'bash',
        isError: typeof entry.exit_code === 'number' && entry.exit_code !== 0,
      },
    ];
  }

  if (looksLikeCodexFileChange(entry)) {
    return [
      {
        id: `turn-${index}-file`,
        type: 'file',
        title: 'File changes',
        content: entry.changes.map((change) => `${change.kind} ${change.path}`).join('\n'),
      },
    ];
  }

  if (looksLikeCodexError(entry)) {
    return [
      {
        id: `turn-${index}-error`,
        type: 'error',
        title: 'Error',
        content: entry.message,
        isError: true,
      },
    ];
  }

  return [
    {
      id: `turn-${index}-raw`,
      type: 'system',
      title: entryTitle(entry),
      content: JSON.stringify(entry, null, 2),
      language: 'json',
    },
  ];
}

function normalizeClaudeAssistant(
  entry: ExtractClaudeAssistant
): TranscriptViewTurn[] {
  const turns: TranscriptViewTurn[] = [];

  entry.message.content.forEach((block, blockIndex) => {
    if (block.type === 'text') {
      turns.push({
        id: `assistant-${blockIndex}`,
        type: 'assistant',
        title: 'Assistant',
        content: block.text,
        tokenCount: entry.message.usage?.output_tokens,
      });
      return;
    }

    if (block.type === 'tool_use') {
      turns.push({
        id: `tool-${blockIndex}`,
        type: 'tool',
        title: block.name,
        subtitle: block.id,
        content: JSON.stringify(block.input, null, 2),
        language: 'json',
      });
    }
  });

  return turns;
}

function normalizeClaudeUser(entry: ExtractClaudeUser, index: number): TranscriptViewTurn[] {
  const content = entry.message.content
    .map((block) => {
      if (typeof block.content === 'string') {
        return block.content;
      }

      if (Array.isArray(block.content)) {
        return block.content.map((item) => item.text ?? `[${item.type}]`).join('\n');
      }

      return '[no content]';
    })
    .join('\n\n');

  return [
    {
      id: `turn-${index}-user`,
      type: 'user',
      title: 'Tool result',
      content,
    },
  ];
}

type ClaudeBase = Record<string, any>;
type ExtractClaudeAssistant = ClaudeBase & {
  type: 'assistant';
  message: {
    content: Array<
      | {
          type: 'text';
          text: string;
        }
      | {
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }
    >;
    usage?: {
      output_tokens?: number;
    };
  };
};

type ExtractClaudeUser = ClaudeBase & {
  type: 'user';
  message: {
    content: Array<{
      type: 'tool_result';
      content:
        | string
        | Array<{
            type: string;
            text?: string;
          }>;
    }>;
  };
};

function looksLikeClaudeSystem(entry: any): entry is ClaudeBase & {
  type: 'system';
  subtype: 'init';
  agent?: string;
  model?: string;
  tools?: string[];
  cwd?: string;
} {
  return entry.type === 'system' && entry.subtype === 'init';
}

function looksLikeClaudeAssistant(entry: any): entry is ExtractClaudeAssistant {
  return entry.type === 'assistant' && entry.message && Array.isArray(entry.message.content);
}

function looksLikeClaudeUser(entry: any): entry is ExtractClaudeUser {
  return entry.type === 'user' && entry.message && Array.isArray(entry.message.content);
}

function looksLikeClaudeResult(entry: any): entry is ClaudeBase & {
  type: 'result';
  subtype: 'success' | 'error';
  num_turns?: number;
  total_cost_usd?: number;
  duration_ms?: number;
  errors?: string[];
} {
  return entry.type === 'result' && typeof entry.subtype === 'string';
}

function looksLikeCodexAgentMessage(entry: any): entry is { type: 'agent_message'; text: string } {
  return entry.type === 'agent_message' && typeof entry.text === 'string';
}

function looksLikeCodexReasoning(entry: any): entry is { type: 'reasoning'; text: string } {
  return entry.type === 'reasoning' && typeof entry.text === 'string';
}

function looksLikeCodexCommand(
  entry: any
): entry is { type: 'command_execution'; command: string; exit_code?: number; aggregated_output?: string } {
  return entry.type === 'command_execution' && typeof entry.command === 'string';
}

function looksLikeCodexFileChange(
  entry: any
): entry is { type: 'file_change'; changes: Array<{ kind: string; path: string }> } {
  return entry.type === 'file_change' && Array.isArray(entry.changes);
}

function looksLikeCodexError(entry: any): entry is { type: 'error'; message: string } {
  return entry.type === 'error' && typeof entry.message === 'string';
}

function entryTitle(entry: Record<string, unknown>) {
  if (typeof entry.type === 'string') {
    return entry.type;
  }
  return 'Entry';
}

async function readOptionalText(path: string) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return undefined;
  }
}

async function readOptionalJson(path: string) {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

function createSummaryMdx() {
  return `import summary from './summary.json';

# Eval Summary

<table>
  <tbody>
    <tr><td><strong>Project</strong></td><td>{summary.project.name}</td></tr>
    <tr><td><strong>Prompt</strong></td><td>{summary.prompt}</td></tr>
    <tr><td><strong>Agent</strong></td><td>{summary.variant.agent}</td></tr>
    <tr><td><strong>Model</strong></td><td>{summary.variant.model}</td></tr>
    <tr><td><strong>Effort</strong></td><td>{summary.variant.effort}</td></tr>
    <tr><td><strong>Score</strong></td><td>{summary.score.score}</td></tr>
    <tr><td><strong>Build</strong></td><td>{summary.grade.buildSuccess ? 'PASS' : 'FAIL'}</td></tr>
    <tr><td><strong>TypeScript errors</strong></td><td>{summary.grade.typeCheckErrors}</td></tr>
  </tbody>
</table>

## Changed Files

<ul>
  {summary.grade.fileChanges.map((change) => (
    <li key={change.path}>
      <code>{change.gitStatus}</code> <code>{change.path}</code>
    </li>
  ))}
</ul>

## Screenshots

<ul>
  {(summary.publish?.screenshots ?? []).map((screenshot) => (
    <li key={screenshot.imagePath}>
      <code>{screenshot.storyFilePath}</code> → <code>{screenshot.imagePath}</code>
    </li>
  ))}
</ul>
`;
}

function createTranscriptMdx() {
  return `import summary from './summary.json';
import transcriptData from './transcript-view-data.json';
import { TranscriptView } from './transcript-view';

# Transcript

<TranscriptView data={transcriptData} summary={summary} />
`;
}

function createTranscriptViewComponent() {
  return `import { useEffect, useRef, useState } from 'react';

const TYPE_COLORS = {
  prompt: { bg: '#fce7f3', text: '#9f1239' },
  system: { bg: '#e0e7ff', text: '#3730a3' },
  assistant: { bg: '#dbeafe', text: '#1e40af' },
  tool: { bg: '#fef3c7', text: '#92400e' },
  user: { bg: '#f3e8ff', text: '#6b21a8' },
  result: { bg: '#dcfce7', text: '#166534' },
  reasoning: { bg: '#e0f2fe', text: '#0c4a6e' },
  command: { bg: '#ede9fe', text: '#5b21b6' },
  file: { bg: '#ecfccb', text: '#365314' },
  error: { bg: '#fee2e2', text: '#991b1b' },
};

const CodeBlock = ({ content, language = '', isError = false }) => {
  const [isTruncated, setIsTruncated] = useState(content.length > 500);
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current && globalThis.hljs) {
      globalThis.hljs.highlightElement(codeRef.current);
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
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <code ref={codeRef} className={language ? \`language-\${language}\` : ''}>
          {content}
        </code>
      </pre>
      {content.length > 500 && (
        <button
          onClick={() => setIsTruncated(!isTruncated)}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
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

const MetadataCard = ({ title, value, subvalue }) => (
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
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{value}</div>
    {subvalue ? (
      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>{subvalue}</div>
    ) : null}
  </div>
);

const Turn = ({ turn }) => {
  const [isExpanded, setIsExpanded] = useState(turn.type === 'prompt' || turn.type === 'result');
  const colors = TYPE_COLORS[turn.type] || TYPE_COLORS.assistant;

  return (
    <div
      style={{
        marginBottom: '1rem',
        border: '1px solid #e5e7eb',
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
        }}
      >
        <div style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▶
        </div>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: colors.bg,
            color: colors.text,
            textTransform: 'uppercase',
          }}
        >
          {turn.type}
        </span>
        <span style={{ fontWeight: 600 }}>{turn.title}</span>
        <span style={{ flex: 1 }} />
        {turn.subtitle ? (
          <span style={{ color: '#6b7280', fontSize: '0.875rem', fontFamily: 'monospace' }}>
            {turn.subtitle}
          </span>
        ) : null}
        {turn.tokenCount ? (
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{turn.tokenCount} tokens</span>
        ) : null}
      </div>
      {isExpanded && (
        <div style={{ padding: '1rem', backgroundColor: 'white' }}>
          {turn.content ? (
            <CodeBlock content={turn.content} language={turn.language} isError={turn.isError} />
          ) : (
            <em style={{ color: '#6b7280' }}>No content</em>
          )}
        </div>
      )}
    </div>
  );
};

export const TranscriptView = ({ data, summary }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = "import hljs from 'https://esm.sh/highlight.js@11.9.0'; window.hljs = hljs;";
    document.head.appendChild(script);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://esm.sh/highlight.js@11.9.0/styles/github-dark-dimmed.css';
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(style);
    };
  }, []);

  const cards = [
    { title: 'Agent', value: summary.variant.agent },
    { title: 'Model', value: summary.variant.model },
    { title: 'Effort', value: summary.variant.effort },
    {
      title: 'Execution',
      value: \`\${summary.execution.turns} turns\`,
      subvalue: \`\${Math.round(summary.execution.duration)}s\${summary.execution.cost != null ? \` · $\${summary.execution.cost.toFixed(2)}\` : ''}\`,
    },
  ];

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {cards.map((card) => (
          <MetadataCard key={card.title} {...card} />
        ))}
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {data.turns.map((turn) => (
          <Turn key={turn.id} turn={turn} />
        ))}
      </div>
    </div>
  );
};
`;
}
