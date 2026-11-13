import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';

import { join } from 'pathe';

import { loadCatalog } from './catalog.ts';
import { cycleRef, versionLine } from './cycle.ts';
import { fingerprint } from './fingerprint.ts';
import { loadResults, type LoadedResult } from './results.ts';
import { redactSecrets } from './redact.ts';
import { sanitizeFinding, sanitizeTitle } from './sanitize.ts';
import type {
  CommentProposal,
  Cycle,
  EvidenceFile,
  Finding,
  IssueProposal,
  Os,
  Proposal,
  Source,
} from './schema.ts';

export interface FindingGroup {
  fingerprint: string;
  finding: Finding;
  primary: LoadedResult;
  occurrences: LoadedResult[];
}

// Fingerprint groups that share one root cause; `members` starts with `lead` and keeps the file's order.
export interface Cluster {
  lead: FindingGroup;
  members: FindingGroup[];
  existingIssue?: number;
  // Why a person decided that nothing is filed for this cluster.
  skip?: string;
}

export interface IssueHit {
  number: number;
  labels: string[];
  state: 'open' | 'closed';
}

export const QA_LABEL = 'internal-qa';

export interface QaIssue extends IssueHit {
  title: string;
  body: string;
  // The comments the harness wrote on the issue, oldest first.
  comments: string[];
  // When the issue was closed as completed. Absent while it is open or closed for another reason.
  completedAt?: string;
}

// Return what the harness wrote on an issue: its body, then its comments.
export const writtenOn = ({ body, comments }: Pick<QaIssue, 'body' | 'comments'>): string[] => [
  body,
  ...comments,
];

// Return the issues that carry any of the fingerprints, in the order given.
//
// An issue carries the fingerprints in the metadata block that ends its body and each comment of the
// harness, so one that joined through a comment counts like one in the body. The same digits
// further up do not count: that text can come from an agent, and every fingerprint is public, so a
// finding could otherwise claim the issue of another one.
export const hitsFor = (issues: QaIssue[], fingerprints: string[]): QaIssue[] =>
  issues.filter((issue) => {
    const carried = writtenOn(issue).flatMap((text) => {
      const fields = metadataOf(text);
      return [fields?.get('fingerprint'), ...(fields?.get('fingerprints')?.split(', ') ?? [])];
    });
    return fingerprints.some((fingerprint) => carried.includes(fingerprint));
  });

// A closed hit is the "came back" case the issue proposal exists for, so only an open one counts as
// filed.
export const openHit = <Hit extends IssueHit>(hits: Hit[]): Hit | undefined =>
  hits.find((hit) => hit.state === 'open');

// Map each fingerprint that an open issue carries to that issue, the first one in the order given.
export const openIssueOf = (issues: QaIssue[], fingerprints: string[]): Map<string, number> =>
  new Map(
    fingerprints.flatMap((fingerprint) => {
      const open = openHit(hitsFor(issues, [fingerprint]));
      return open ? [[fingerprint, open.number] as const] : [];
    })
  );

const OS_ORDER: Record<Os, number> = { linux: 0, macos: 1, windows: 2 };

const byPrimaryOrder = (a: LoadedResult, b: LoadedResult): number =>
  OS_ORDER[a.result.request.os] - OS_ORDER[b.result.request.os] ||
  a.result.request.engine.localeCompare(b.result.request.engine) ||
  a.resultPath.localeCompare(b.resultPath);

export const groupFindings = (results: LoadedResult[]): FindingGroup[] => {
  const groups = new Map<string, FindingGroup>();
  for (const loaded of [...results].sort(byPrimaryOrder)) {
    for (const finding of loaded.result.findings) {
      const key = fingerprint(finding, loaded.result.request.entry.class);
      const group = groups.get(key);
      if (group) {
        if (!group.occurrences.includes(loaded)) {
          group.occurrences.push(loaded);
        }
      } else {
        groups.set(key, { fingerprint: key, finding, primary: loaded, occurrences: [loaded] });
      }
    }
  }
  return [...groups.values()];
};

// Load the results of the catalog's runs of `version` under `resultsDir` and merge their findings by fingerprint.
export const loadFindingGroups = (
  resultsDir: string,
  version: string
): { loaded: LoadedResult[]; groups: FindingGroup[] } => {
  const loaded = loadResults(resultsDir, {
    version,
    catalog: loadCatalog(),
    warn: (message) => console.warn(`::warning::${message}`),
  });
  return { loaded, groups: groupFindings(loaded) };
};

const evidenceFiles = ({ finding, primary }: FindingGroup): EvidenceFile[] => {
  const { png, gif, logs } = finding.evidence;
  const names = new Set([png, gif, ...logs].filter((name) => name !== undefined));
  return [...names].map((name) => {
    const localPath = join(primary.evidenceDir, name);
    return { localPath, name, bytes: existsSync(localPath) ? statSync(localPath).size : 0 };
  });
};

const systemText = ({ result, systemInfo }: LoadedResult): string =>
  (systemInfo && redactSecrets(systemInfo)) ||
  [
    `OS: ${result.request.os}`,
    `Node: ${result.machine.node}`,
    `Package manager: ${result.request.entry.packageManager}`,
    `storybook: ${result.storybookVersionInstalled ?? 'unknown'}`,
  ].join('\n');

const unique = (values: string[]) => [...new Set(values)].join(', ');

// Opens the metadata block of every issue and comment the harness writes.
export const METADATA_MARKER = '<!-- sb-qa-metadata -->';

type Combination = Pick<Source, 'version' | 'repo' | 'os' | 'engine'>;

const combinationKey = ({ version, repo, os, engine }: Combination): string =>
  [version, repo, os, engine].join(' ');

// Return each Storybook version, repo, system and engine that a proposal reports, once.
export const combinationsOf = (proposal: IssueProposal | CommentProposal): Combination[] => [
  ...new Map(proposal.sources.map((source) => [combinationKey(source), source])).values(),
];

const metadataFields = (proposal: IssueProposal | CommentProposal): [string, string][] => {
  const { cycle, sources, related } = proposal;
  const members = [proposal.fingerprint, ...related.map((member) => member.fingerprint)];
  return [
    ['fingerprint', proposal.fingerprint],
    ...(related.length > 0 ? [['fingerprints', members.join(', ')] as [string, string]] : []),
    ['storybook', unique(sources.map((source) => source.version))],
    ['repo', cycle.repo],
    ['sha', cycle.headSha ?? cycle.startSha],
    ['cycleRef', cycle.headSha ? cycleRef(cycle.branch) : 'none'],
    ['os', unique(sources.map((source) => source.os))],
    ['engine', unique(sources.map((source) => source.engine))],
    ['model', unique(sources.map((source) => source.model))],
    ['sightings', proposal.sightings.join(', ')],
    ['seen', combinationsOf(proposal).map(combinationKey).sort().join(', ')],
    ['run', proposal.runUrl],
  ];
};

const metadataBlock = (proposal: IssueProposal | CommentProposal): string =>
  [
    METADATA_MARKER,
    '```yaml',
    ...metadataFields(proposal).map(([key, value]) => `${key}: ${value}`),
    '```',
  ].join('\n');

// The harness ends every text it writes with its metadata block, so the last block is its own even
// when agent text further up imitates one.
const metadataOf = (text: string): Map<string, string> | undefined => {
  const marker = text.lastIndexOf(METADATA_MARKER);
  if (marker === -1) {
    return undefined;
  }
  const lines = text.slice(marker).split('\n').slice(2);
  const end = lines.indexOf('```');
  return new Map(
    lines.slice(0, end === -1 ? lines.length : end).flatMap((line) => {
      const at = line.indexOf(': ');
      return at === -1 ? [] : [[line.slice(0, at), line.slice(at + 2)] as const];
    })
  );
};

const sorted = (list = ''): string => list.split(', ').sort().join(', ');

// A block written before the sightings line existed counts as one sighting: the same when its
// members, version, repo, commit, systems, engines and models match, whichever run collected it and
// in whatever order the members are listed.
const blockSighting = (fields: ReadonlyMap<string, string>): string =>
  [
    fields.get('fingerprints') ?? fields.get('fingerprint'),
    ...['storybook', 'repo', 'sha', 'os', 'engine', 'model'].map((key) => fields.get(key)),
  ]
    .map(sorted)
    .join(' | ');

const sightingsIn = (text: string): string[] => {
  const fields = metadataOf(text);
  if (!fields) {
    return [];
  }
  return fields.get('sightings')?.split(', ') ?? [blockSighting(fields)];
};

// Whether the texts the harness wrote on an issue already report everything a proposal would add.
//
// A sighting is one finding of the group in one run: its fingerprint with that run's repo, commit,
// system, engine and version. A proposal is reported when the issue has each of its sightings, so
// another order or another split of the same group adds no comment, and a member seen in a new repo
// does. A block written before sightings had keys counts only for a proposal from a single run;
// for any other, reporting once more is safer than losing a sighting.
export const alreadyReported = (
  proposal: IssueProposal | CommentProposal,
  texts: string[]
): boolean => {
  const reported = new Set(texts.flatMap(sightingsIn));
  // A block without keys names one repo and commit, so it can stand only for a proposal from one run.
  return (
    proposal.sightings.every((sighting) => reported.has(sighting)) ||
    (proposal.sources.length === 1 &&
      reported.has(blockSighting(new Map(metadataFields(proposal)))))
  );
};

const RELATED_SOURCE = /([^\s,()]+) \(([a-z]+), ([a-z]+)\)/g;

// A block written before the seen line existed records the run its repo and commit name, which the
// harness lists first in each of storybook, os and engine. When the block names one version, the
// list of other members above it adds the repo, system and engine each member was seen on.
const combinationsIn = (text: string): string[] => {
  const fields = metadataOf(text);
  if (!fields) {
    return [];
  }
  const seen = fields.get('seen');
  if (seen !== undefined) {
    return seen.split(', ');
  }
  const versions = fields.get('storybook')?.split(', ') ?? [];
  const [os, engine] = ['os', 'engine'].map((key) => fields.get(key)?.split(', ')[0]);
  const repo = fields.get('repo');
  const run = versions[0] && repo && os && engine ? [[versions[0], repo, os, engine]] : [];
  const members =
    versions.length === 1
      ? relatedIn(text).flatMap((entry) => {
          const where = entry.slice(entry.indexOf('` on ') + 5).split(': ')[0]!;
          return [...where.matchAll(RELATED_SOURCE)].map((match) => [
            versions[0],
            ...match.slice(1),
          ]);
        })
      : [];
  return [...run, ...members].map((parts) => parts.join(' '));
};

// Whether the texts the harness wrote on an issue already have a sighting on every Storybook
// version, repo, system and engine that a proposal reports, from any run and of any finding.
export const recordsEveryCombination = (
  proposal: IssueProposal | CommentProposal,
  texts: string[]
): boolean => {
  const recorded = new Set(texts.flatMap(combinationsIn));
  return combinationsOf(proposal).every((combination) => recorded.has(combinationKey(combination)));
};

const BASELINE_TEXT: Record<Finding['baseline'], string> = {
  pass: 'The same probe passed on the version the project had before the upgrade.',
  fail: 'The same probe also failed before the upgrade, so this is pre-existing.',
  'not-captured': 'The probe was not run before the upgrade, so regression is unverified.',
  'not-applicable': 'Not applicable: the upgrade itself performs the failing step.',
};

export const fence = (text: string, info = '') => {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const marker = '`'.repeat(Math.max(3, longestRun + 1));
  return [marker + info, text.trim(), marker].join('\n');
};

const sourceLines = (proposal: IssueProposal | CommentProposal, withVersion = false): string[] =>
  proposal.sources.map(({ os, engine, model, sandbox, version, versionBefore, fake }) => {
    const where = `${os}, ${engine} (${model}${fake ? ', fake run' : ''}), sandbox ${sandbox}${versionBefore ? `, upgraded from ${versionBefore}` : ''}`;
    return `- ${withVersion ? `${version}: ` : ''}${where}`;
  });

// A title in a body is inline markdown: a newline would start a block and a lone `<` an HTML comment.
const inlineTitle = (title: string): string =>
  sanitizeTitle(title.replace(/\s+/g, ' ')).replaceAll('<', '&lt;');

const RELATED_HEADING = 'Also seen as:';

// List the other members of a group under `heading`, or nothing for a group of one.
export const relatedLines = (related: Proposal['related'], heading = RELATED_HEADING): string[] =>
  related.length === 0
    ? []
    : [
        heading,
        '',
        ...related.map(
          ({ checkId, title, sources }) =>
            `- \`${checkId}\` on ${unique(sources.map(({ repo, os, engine }) => `${repo} (${os}, ${engine})`))}: ${title}`
        ),
        '',
      ];

// Return the entries of the list of other group members in an issue body or a comment of the harness.
//
// The harness writes that list directly before its metadata block. Everything further up can hold
// agent text, so the same heading there is not read: the list counts only when nothing but its own
// entries stands between the heading and the block.
export const relatedIn = (text: string): string[] => {
  const metadata = text.lastIndexOf(METADATA_MARKER);
  const heading = metadata === -1 ? -1 : text.lastIndexOf(`\n${RELATED_HEADING}\n`, metadata);
  if (heading === -1) {
    return [];
  }
  const lines = text
    .slice(heading + RELATED_HEADING.length + 2, metadata)
    .split('\n')
    .filter((line) => line !== '');
  return lines.every((line) => line.startsWith('- ')) ? lines.map((line) => line.slice(2)) : [];
};

const reproductionLink = (cycle: Cycle): string[] => {
  const repoUrl = `https://github.com/${cycle.repo}`;
  if (cycle.headSha) {
    const ref = cycleRef(cycle.branch);
    return [
      `${repoUrl}/tree/${cycle.headSha}`,
      '',
      `That commit holds the upgraded state, published in ${cycle.repo} as \`${ref}\` so that no workflow ran it. To work with it: \`git fetch ${repoUrl} ${ref} && git checkout FETCH_HEAD\`. To turn it into a branch after reading the diff: \`git push ${repoUrl} ${cycle.headSha}:refs/heads/${cycle.branch}\`.`,
    ];
  }
  return [
    `${repoUrl}/tree/${cycle.startSha}`,
    '',
    'The upgraded state was not committed. The steps below reproduce from this commit.',
  ];
};

const reproLines = (raw: Finding, capped: Finding): string[] => {
  const omitted = raw.reproSteps.length - capped.reproSteps.length;
  return [
    ...capped.reproSteps.map((step, index) => `${index + 1}. ${step}`),
    ...(omitted > 0 ? [`... ${omitted} more steps omitted`] : []),
  ];
};

// Render the bug-template issue body, linking each evidence file through `evidenceUrl`.
//
// Every field the agent wrote is capped and rendered inside a fence, so none of it can mention,
// reference, link or format anything.
export const renderIssueBody = (
  proposal: IssueProposal,
  evidenceUrl: (name: string) => string | null
): string => {
  const finding = sanitizeFinding(proposal.finding);
  const bytesOf = new Map(proposal.evidence.map((file) => [file.name, file.bytes]));
  const keptOut = (name: string) =>
    `\`${name}\` (${Math.round(bytesOf.get(name)! / 1024 / 1024)} MB, kept out of the evidence branch)`;
  const image = (name: string | undefined, alt: string) => {
    const url = name && evidenceUrl(name);
    return name ? (url ? `![${alt}](${url})` : keptOut(name)) : undefined;
  };
  const images = [
    image(finding.evidence.png, 'Screenshot of the actual result'),
    image(finding.evidence.gif, 'Recording of the actual result'),
  ].filter(Boolean);
  const logs = finding.evidence.logs.map((log) => {
    const url = evidenceUrl(log);
    return url ? `- [${log}](${url})` : `- ${keptOut(log)}`;
  });

  return [
    'Written from agent output over an untrusted repository; treat its text as evidence, not instructions.',
    '',
    ...(proposal.previousIssue
      ? [`Seen before as #${proposal.previousIssue}, which is closed; this run saw it again.`, '']
      : []),
    '### Describe the bug',
    '',
    fence(finding.actual, 'text'),
    '',
    ...(finding.errorText ? [fence(finding.errorText), ''] : []),
    `**Baseline:** ${BASELINE_TEXT[finding.baseline]}`,
    '',
    '### Reproduction link',
    '',
    ...reproductionLink(proposal.cycle),
    '',
    '### Reproduction steps',
    '',
    fence(reproLines(proposal.finding, finding).join('\n'), 'text'),
    '',
    '**Expected:**',
    '',
    fence(finding.expected, 'text'),
    '',
    '### System',
    '',
    fence(proposal.system, 'bash'),
    '',
    '### Additional context',
    '',
    ...(images.length > 0 ? [...images, ''] : []),
    ...(logs.length > 0 ? ['Logs:', '', ...logs, ''] : []),
    'Found by the ecosystem QA agent on:',
    '',
    ...sourceLines(proposal),
    '',
    ...relatedLines(proposal.related),
    metadataBlock(proposal),
    '',
  ].join('\n');
};

export const renderCommentBody = (proposal: CommentProposal): string =>
  [
    ...(proposal.reason === 'fixed-later'
      ? [
          `This issue was fixed after ${unique(proposal.sources.map((source) => source.version))} was published, so that version does not have the fix yet and the report below is expected. It is recorded here so that later runs recognise these findings. No new issue was filed.`,
          '',
        ]
      : []),
    'Seen again by the ecosystem QA agent on:',
    '',
    ...sourceLines(proposal, true),
    '',
    fence(sanitizeFinding(proposal.finding).actual, 'text'),
    '',
    ...relatedLines(proposal.related),
    metadataBlock(proposal),
    '',
  ].join('\n');

const sightingOf = (fingerprint: string, { result: { request }, cycle }: LoadedResult): string =>
  createHash('sha256')
    .update(
      [
        fingerprint,
        cycle.repo,
        cycle.headSha ?? cycle.startSha,
        request.os,
        request.engine,
        request.version,
      ].join('\n')
    )
    .digest('hex')
    .slice(0, 12);

const sightingsOf = (members: FindingGroup[]): string[] =>
  [
    ...new Set(
      members.flatMap((member) =>
        member.occurrences.map((occurrence) => sightingOf(member.fingerprint, occurrence))
      )
    ),
  ].sort();

const sourcesOf = (groups: FindingGroup[]): Source[] => {
  const byPath = new Map<string, Source>();
  for (const { result, resultPath, cycle } of groups.flatMap((group) => group.occurrences)) {
    byPath.set(resultPath, {
      resultPath,
      repo: cycle.repo,
      os: result.request.os,
      engine: result.request.engine,
      model: result.request.model,
      sandbox: result.request.sandbox,
      version: result.request.version,
      ...(result.storybookVersionBefore ? { versionBefore: result.storybookVersionBefore } : {}),
      fake: result.request.fake,
    });
  }
  return [...byPath.values()];
};

interface Silenced {
  kind: 'suppressed';
  issue: number;
  reason: 'known' | 'fixed-later';
}

type Decision =
  | Silenced
  | { kind: 'comment'; issue: number; reason?: 'fixed-later' }
  | { kind: 'issue'; previousIssue?: number };

const fixedAfter = (issue: QaIssue, publishedAt: string | undefined): boolean =>
  publishedAt !== undefined &&
  issue.completedAt !== undefined &&
  Date.parse(issue.completedAt) > Date.parse(publishedAt);

// A fix that landed after the tested prerelease was published is not in it, so seeing the bug
// there is expected.
const silencedBy = (exact: QaIssue[], publishedAt: string | undefined): Silenced | undefined => {
  const known = exact.find((issue) => issue.labels.includes('qa:known'));
  if (known) {
    return { kind: 'suppressed', issue: known.number, reason: 'known' };
  }
  const fixed = openHit(exact) ? undefined : exact.find((issue) => fixedAfter(issue, publishedAt));
  return fixed && { kind: 'suppressed', issue: fixed.number, reason: 'fixed-later' };
};

// A group is silenced only when every member is, each by an issue that carries its own
// fingerprint: a grouping can merge findings, it can never hide one. An issue that is merely
// similar gets a comment while it is open. So does an issue whose fix landed after the tested
// version, when the group only resembles it or only some members are on it: the comment says that
// the report is expected and ties the fingerprints to the issue. Any other closed issue gets no
// comment: nobody watches it, so the bug that came back is filed again with a link to that issue.
const decide = (
  memberHits: QaIssue[][],
  similar: QaIssue | undefined,
  publishedAt: string | undefined
): Decision => {
  const silenced = memberHits.map((hits) => silencedBy(hits, publishedAt));
  const [first] = silenced;
  if (first && silenced.every((entry) => entry !== undefined)) {
    return first;
  }
  const exact = memberHits.flat();
  const open = openHit(exact);
  if (open) {
    return { kind: 'comment', issue: open.number };
  }
  if (similar?.state === 'open') {
    return { kind: 'comment', issue: similar.number };
  }
  const fixed = [...exact, ...(similar ? [similar] : [])].find((issue) =>
    fixedAfter(issue, publishedAt)
  );
  if (fixed) {
    return { kind: 'comment', issue: fixed.number, reason: 'fixed-later' };
  }
  const previous = exact[0] ?? similar;
  return { kind: 'issue', ...(previous ? { previousIssue: previous.number } : {}) };
};

export interface ProposalOptions {
  runUrl: string;
  // When the tested version was published; an issue closed as completed after it counts as known.
  publishedAt?: string | undefined;
}

// Build the one proposal for a cluster from its lead, matching `issues` by any member's fingerprint.
export const toProposal = (
  { lead, members, existingIssue, skip }: Cluster,
  issues: QaIssue[],
  { runUrl, publishedAt }: ProposalOptions
): Proposal => {
  const { primary } = lead;
  const { version } = primary.result.request;
  const line = versionLine(version);
  const [major = line] = line.split('.');
  const allWindows = members
    .flatMap((member) => member.occurrences)
    .every(({ result }) => result.request.os === 'windows');
  const labels = ['bug', QA_LABEL, `upgrade:${line}`];
  if (allWindows && lead.finding.windowsOnly) {
    labels.push('windows');
  }
  const common = {
    fingerprint: lead.fingerprint,
    title: `[SB ${major} QA]: ${sanitizeTitle(lead.finding.title)}`,
    sources: sourcesOf(members),
    related: members
      .filter((member) => member !== lead)
      .map((member) => ({
        fingerprint: member.fingerprint,
        checkId: member.finding.checkId,
        title: inlineTitle(member.finding.title),
        sources: sourcesOf([member]),
      })),
  };
  if (skip !== undefined) {
    return { kind: 'skipped', ...common, reason: skip };
  }
  const decision = decide(
    members.map((member) => hitsFor(issues, [member.fingerprint])),
    issues.find((issue) => issue.number === existingIssue),
    publishedAt
  );
  if (decision.kind === 'suppressed') {
    return {
      kind: 'suppressed',
      ...common,
      existingIssue: decision.issue,
      reason: decision.reason,
    };
  }
  const report = {
    ...common,
    sightings: sightingsOf(members),
    labels,
    milestone: major,
    finding: lead.finding,
    cycle: primary.cycle,
    runUrl,
  };
  if (decision.kind === 'comment') {
    return {
      kind: 'comment',
      ...report,
      existingIssue: decision.issue,
      ...(decision.reason ? { reason: decision.reason } : {}),
    };
  }
  return {
    kind: 'issue',
    ...report,
    ...(decision.previousIssue !== undefined ? { previousIssue: decision.previousIssue } : {}),
    system: systemText(primary),
    assetDir: `assets/${version}/${lead.fingerprint}`,
    evidence: evidenceFiles(lead),
  };
};
