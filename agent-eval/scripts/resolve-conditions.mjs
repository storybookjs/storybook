// Resolves which eval features run for this workflow execution. A condition is
// active when its workflow_dispatch input was set or its label is on the PR;
// scheduled runs activate every condition (the weekly full-suite run).
//
// Prints one `name=value` line per condition plus `scope_line` (the labels of
// the active conditions) as step outputs, and fails on labels under the
// declared prefix that the config does not know — a typo like
// `agent-eval:extra-eval` would otherwise silently run the default smoke scope.
import { appendFileSync, readFileSync } from 'node:fs'

const configFile = process.env.CONFIG_FILE
const config = JSON.parse(readFileSync(configFile, 'utf8'))
const labels = (JSON.parse(process.env.PR_LABELS || '[]') ?? []).filter((label) => typeof label === 'string')
const inputActive = (name) => process.env[`INPUT_${name.toUpperCase()}`] === 'true'

const declared = new Set([config.optInLabel, ...config.conditions.map((condition) => condition.label)])
const unknown = labels.filter((label) => label.startsWith(config.labelPrefix) && !declared.has(label))
if (unknown.length > 0) {
  console.error(`::error title=Unknown eval labels::${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not declared in ${configFile}.`)
  process.exit(1)
}

const active = config.conditions.filter(
  (condition) => process.env.GITHUB_EVENT_NAME === 'schedule' || inputActive(condition.input) || labels.includes(condition.label),
)

const emit = (line) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
  console.log(line)
}
for (const condition of config.conditions) {
  emit(`${condition.id}=${active.includes(condition) ? '1' : ''}`)
}
emit(`scope_line=${active.map((condition) => condition.label).join(', ')}`)
