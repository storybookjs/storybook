#!/usr/bin/env bash
# find-story.sh — Look up story entries from a running Storybook instance.
#
# Usage:
#   .claude/scripts/find-story.sh [FRAGMENT] [--port PORT]
#
# Arguments:
#   FRAGMENT    Optional. Case-insensitive string to filter by title, name,
#               id, exportName, or importPath. Omit to list all stories.
#   --port      Optional. Port Storybook is running on (default: 6006).
#
# Output (one line per match):
#   id | title | name | exportName | importPath
#
# Examples:
#   .claude/scripts/find-story.sh popover
#   .claude/scripts/find-story.sh "controls/function" --port 6007
#   .claude/scripts/find-story.sh   # list all

set -euo pipefail

FRAGMENT=""
PORT="6006"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    *)      FRAGMENT="$1"; shift ;;
  esac
done

INDEX_URL="http://localhost:${PORT}/index.json"

INDEX=$(curl -sf "$INDEX_URL") || {
  echo "ERROR: Could not reach $INDEX_URL — is Storybook running on port $PORT?" >&2
  exit 1
}

echo "$INDEX" | STORY_FRAGMENT="$FRAGMENT" node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(chunks.join(''));
  const fragment = (process.env.STORY_FRAGMENT || '').toLowerCase();
  const entries = Object.values(data.entries || {});
  const matches = fragment
    ? entries.filter(e =>
        (e.title || '').toLowerCase().includes(fragment) ||
        (e.name || '').toLowerCase().includes(fragment) ||
        (e.id || '').toLowerCase().includes(fragment) ||
        (e.exportName || '').toLowerCase().includes(fragment) ||
        (e.importPath || '').toLowerCase().includes(fragment)
      )
    : entries;

  if (matches.length === 0) {
    process.stderr.write('No stories matched: ' + process.env.STORY_FRAGMENT + '\n');
    process.exit(1);
  }

  matches.forEach(e => {
    console.log([e.id, e.title, e.name, e.exportName, e.importPath].join(' | '));
  });
});
"
