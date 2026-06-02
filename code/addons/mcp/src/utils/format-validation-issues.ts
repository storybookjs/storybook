/**
 * Wraps a standard-schema validator so tmcp's "Invalid arguments for tool …"
 * error contains a short, agent-readable issue list instead of the raw
 * valibot dump.
 *
 * tmcp renders validation failures as `JSON.stringify(issues)`, so the wrapper
 * has to return shortened *issue objects*, not strings. Each kept issue is
 * trimmed to `{ path, message }` (we drop `input`, `requirement`, `lang`,
 * `abortEarly`, `abortPipeEarly`, and other metadata that confuses agents),
 * and we rewrite the common "missing required key" case into a flat human
 * sentence.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';

// Shadow the spec's `Issue` shape with one that includes the fields valibot
// adds (`kind`, `type`, `expected`, `received`, …) so {@link summarizeIssue}
// can introspect them. The structural compatibility with the spec is what
// matters at the boundary — see {@link withFriendlyErrors}' generic constraint.
interface StandardSchemaIssue extends StandardSchemaV1.Issue {
	readonly kind?: string;
	readonly type?: string;
	readonly expected?: string;
	readonly received?: string;
	readonly [k: string]: unknown;
}

interface FriendlyIssue {
	path: string;
	message: string;
}


function formatPath(path: StandardSchemaIssue['path']): string {
	if (!path || path.length === 0) return '';
	let out = '';
	for (const segment of path) {
		// Standard-Schema allows two segment shapes — a raw `PropertyKey`
		// (string / number / symbol) or a `PathSegment` object with `.key`.
		// Valibot emits the object form; other validators may emit primitives.
		// We coerce both.
		const key =
			typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment;
		if (typeof key === 'number') out += `[${key}]`;
		else if (key !== undefined && key !== null) out += out === '' ? String(key) : `.${String(key)}`;
	}
	return out;
}

function summarizeIssue(issue: StandardSchemaIssue): FriendlyIssue {
	const path = formatPath(issue.path);

	// Common valibot shape for a missing required object key:
	//   { kind: 'schema', type: 'object'|'strict_object',
	//     expected: '"fieldName"', received: 'undefined', message: 'Invalid key: …' }
	const isMissingKey =
		issue.kind === 'schema' &&
		(issue.type === 'object' || issue.type === 'strict_object' || issue.type === 'loose_object') &&
		typeof issue.expected === 'string' &&
		issue.expected.length >= 2 &&
		issue.expected.startsWith('"') &&
		issue.expected.endsWith('"') &&
		issue.received === 'undefined';

	if (isMissingKey) {
		const field = issue.expected!.slice(1, -1);
		// valibot's path points to where the missing field WOULD live; the
		// terminal segment is the field name itself, so the "at" suffix in the
		// message should refer to the parent container (or be omitted at the
		// top level).
		const parentPathStr = formatPath((issue.path ?? []).slice(0, -1));
		const where = parentPathStr ? ` at \`${parentPathStr}\`` : '';
		return { path, message: `Missing required field \`${field}\`${where}.` };
	}

	return { path, message: issue.message };
}

/**
 * Wrap a standard-schema validator so that validation failures contain
 * trimmed, agent-readable issue objects instead of raw valibot metadata.
 *
 * Successful inputs pass through unchanged (we don't touch the parsed value).
 *
 * Standard Schema validators are POJOs by convention (data fields + a
 * `~standard` slot, no prototype methods), so spread-and-replace is enough
 * — no Proxy required.
 */
export function withFriendlyErrors<TSchema extends StandardSchemaV1>(
	schema: TSchema,
): TSchema {
	const original = schema['~standard'];
	return {
		...schema,
		'~standard': {
			...original,
			validate(input: unknown) {
				const result = original.validate(input);
				const trim = (r: Awaited<ReturnType<typeof original.validate>>) =>
					// Cast: the spec issue type is the base shape; validators
					// (notably valibot) augment with `kind`, `type`, `expected`,
					// `received` — see {@link StandardSchemaIssue}.
					r.issues
						? { issues: (r.issues as readonly StandardSchemaIssue[]).map(summarizeIssue) }
						: r;
				return (result instanceof Promise ? result.then(trim) : trim(result)) as ReturnType<
					typeof original.validate
				>;
			},
		},
	};
}
