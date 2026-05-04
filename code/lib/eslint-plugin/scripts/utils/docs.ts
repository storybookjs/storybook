import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

import { minimatch } from 'minimatch';
import { format } from 'oxfmt';
import type { FormatConfig } from 'oxfmt';

import type { TRuleListWithoutName, TRulesList } from '../update-rules-list.ts';
import { categoryIds } from './categories.ts';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const readmePath = resolve(REPO_ROOT, 'docs/configure/integration/eslint-plugin.mdx');
const readmeRelPath = 'docs/configure/integration/eslint-plugin.mdx';
const ruleDocRelPath = (ruleName: string) => `code/lib/eslint-plugin/docs/rules/${ruleName}.md`;

let cachedFormatConfig: {
  $schema?: string;
  ignorePatterns?: unknown;
  overrides?: Array<{ files: string | string[]; options: Record<string, unknown> }>;
  [key: string]: unknown;
} | null = null;

// oxfmt programmatic API doesn't support loading config files, so we need to do it ourselves. We also need to merge the base options with the overrides based on the file path.
const loadFormatOptions = async (relPath: string): Promise<FormatConfig> => {
  if (!cachedFormatConfig) {
    cachedFormatConfig = JSON.parse(await readFile(resolve(REPO_ROOT, '.oxfmtrc.json'), 'utf8'));
  }

  const {
    $schema: _schema,
    ignorePatterns: _ignore,
    overrides,
    ...baseOptions
  } = cachedFormatConfig!;
  const merged: Record<string, unknown> = { ...baseOptions };

  for (const override of overrides ?? []) {
    const patterns = ([] as string[]).concat(override.files);
    if (patterns.some((p) => minimatch(relPath, p))) {
      Object.assign(merged, override.options);
    }
  }

  return merged as FormatConfig;
};

export const configBadges = categoryIds.reduce(
  (badges, category) => ({
    ...badges,
    // in case we ever want to add nice looking badges. Not in use at the moment
    [category]: `![${category}-badge][]`,
  }),
  {}
);

export const emojiKey = {
  fixable: '✅',
};

const staticElements = {
  listHeaderRow: ['Name', 'Description', 'Automatically fixable', 'Included in configurations'],
  listSpacerRow: Array(4).fill('-'),
  rulesListKey: [
    '',
    '',
    [
      `**Configurations**:`,
      Object.entries(configBadges)
        .map(([template]) => template)
        .join(', '),
    ].join(' '),
  ].join('\n'),
};

const generateRulesListTable = (rulesList: TRuleListWithoutName[]) =>
  [staticElements.listHeaderRow, staticElements.listSpacerRow, ...rulesList]
    .map((column) => `|${column.join('|')}|`)
    .join('\n');

const generateRulesListMarkdown = (rulesList: TRuleListWithoutName[]) =>
  ['', staticElements.rulesListKey, '', generateRulesListTable(rulesList), ''].join('\n');

const listBeginMarker = '{/* RULES-LIST:START */}';
const listEndMarker = '{/* RULES-LIST:END */}';

const overWriteRulesList = (rulesList: TRuleListWithoutName[], readme: string) => {
  const listStartIndex = readme.indexOf(listBeginMarker);
  const listEndIndex = readme.indexOf(listEndMarker);

  if ([listStartIndex, listEndIndex].includes(-1)) {
    throw new Error(`cannot find start or end rules-list`);
  }

  return [
    readme.substring(0, listStartIndex - 1),
    listBeginMarker,
    '',
    generateRulesListMarkdown(rulesList),
    readme.substring(listEndIndex),
  ].join('\n');
};

const ruleCategoriesBeginMarker = '<!-- RULE-CATEGORIES:START -->';
const ruleCategoriesEndMarker = '<!-- RULE-CATEGORIES:END -->';

const overWriteRuleDocs = (rule: TRulesList, ruleDocFile: string) => {
  const ruleCategoriesStartIndex = ruleDocFile.indexOf(ruleCategoriesBeginMarker);
  const ruleCategoriesEndIndex = ruleDocFile.indexOf(ruleCategoriesEndMarker);

  if ([ruleCategoriesStartIndex, ruleCategoriesEndIndex].includes(-1)) {
    throw new Error(`cannot find start or end rules-categories`);
  }

  return [
    ruleDocFile.substring(0, ruleCategoriesStartIndex - 1),
    ruleCategoriesBeginMarker,
    '',
    `**Included in these configurations**: ${rule[4]}`,
    ruleDocFile.substring(ruleCategoriesEndIndex),
  ].join('\n');
};

export const writeRulesListInReadme = async (rulesList: TRulesList[]) => {
  const readme = await readFile(readmePath, 'utf8');
  const rulesListWithoutName = rulesList.map((rule) => rule.slice(1)) as TRuleListWithoutName[];
  const options = await loadFormatOptions(readmeRelPath);
  const { code } = await format(
    readmeRelPath,
    overWriteRulesList(rulesListWithoutName, readme),
    options
  );
  await writeFile(readmePath, code);
};

export const updateRulesDocs = async (rulesList: TRulesList[]) => {
  await Promise.all(
    rulesList.map(async (rule) => {
      const ruleName = rule[0];
      const relPath = ruleDocRelPath(ruleName);
      const ruleDocFilePath = resolve(REPO_ROOT, relPath);
      const ruleDocFile = await readFile(ruleDocFilePath, 'utf8');
      const options = await loadFormatOptions(relPath);
      const { code } = await format(relPath, overWriteRuleDocs(rule, ruleDocFile), options);
      await writeFile(ruleDocFilePath, code);
    })
  );
};
