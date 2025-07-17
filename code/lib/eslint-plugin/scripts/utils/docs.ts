import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { format, resolveConfig } from 'prettier';

import type { TRuleListWithoutName, TRulesList } from '../update-rules-list';
import { categoryIds } from './categories';

const prettierConfig = resolveConfig(__dirname);
const readmePath = resolve(
  __dirname,
  `../../../../../docs/configure/integration/eslint-plugin.mdx`
);
const ruleDocsPath = resolve(__dirname, `../../docs/rules`);

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
  const newReadme = await format(overWriteRulesList(rulesListWithoutName, readme), {
    parser: 'markdown',
    ...(await prettierConfig),
  });
  // Workaround for prettier that keeps replacing {/* xyz */} with {_ xyz _} and that breaks the docs
  const contentToWrite = newReadme.replaceAll('{/_', '{/*').replaceAll('_/}', '*/}');
  await writeFile(readmePath, contentToWrite);
};

export const updateRulesDocs = async (rulesList: TRulesList[]) => {
  await Promise.all(
    rulesList.map(async (rule) => {
      const ruleName = rule[0];
      const ruleDocFilePath = resolve(ruleDocsPath, `${ruleName}.md`);
      const ruleDocFile = await readFile(ruleDocFilePath, 'utf8');

      const updatedDocFile = await format(overWriteRuleDocs(rule, ruleDocFile), {
        parser: 'markdown',
        ...(await prettierConfig),
      });

      await writeFile(ruleDocFilePath, updatedDocFile);
    })
  );
};
