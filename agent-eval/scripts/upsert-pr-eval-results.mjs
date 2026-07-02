import { text } from 'node:stream/consumers';

const START_MARKER = '<!-- agent-eval-results:start -->';
const END_MARKER = '<!-- agent-eval-results:end -->';

// Reads the current PR body from stdin and the rendered results markdown from
// the SUMMARY env var, then writes the updated body to stdout. The results are
// replaced in place between the markers on reruns, or appended on first run.
const summary = process.env.SUMMARY;

if (!summary) {
	console.error('SUMMARY env var is required');
	process.exit(1);
}

// trimEnd only: a full trim would rewrite the user-authored body prefix (e.g.
// leading blank lines or indentation the author put there deliberately).
const body = (await text(process.stdin)).trimEnd();
const section = `${START_MARKER}\n\n${summary.trim()}\n\n${END_MARKER}`;

const startIndex = body.indexOf(START_MARKER);
const endIndex = body.indexOf(END_MARKER);

const updated =
	startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
		? `${body.slice(0, startIndex)}${section}${body.slice(endIndex + END_MARKER.length)}`
		: `${body}${body ? '\n\n' : ''}${section}`;

process.stdout.write(`${updated}\n`);
