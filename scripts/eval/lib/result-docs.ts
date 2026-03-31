import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeEvalResultDocs(resultsDir: string) {
  await Promise.all([
    writeFile(join(resultsDir, 'summary.mdx'), createSummaryMdx()),
    writeFile(join(resultsDir, 'transcript.mdx'), createTranscriptMdx()),
  ]);
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

## Raw JSON

<pre>{JSON.stringify(summary, null, 2)}</pre>
`;
}

function createTranscriptMdx() {
  return `import transcript from './transcript.json';

# Transcript

{transcript.map((entry, index) => (
  <details key={index} open={index < 3}>
    <summary>{entry.type ?? 'unknown'} #{index + 1}</summary>
    <pre>{JSON.stringify(entry, null, 2)}</pre>
  </details>
))}
`;
}
