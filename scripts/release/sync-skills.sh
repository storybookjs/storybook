#!/usr/bin/env bash
# Publishes code/lib/claude-plugin/skills as committed at STORYBOOK_REF (default HEAD).
# A prerelease lands on `next`, a release on `main`. The tag is the only version marker.
set -euo pipefail

: "${VERSION:?e.g. 11.0.0-alpha.3}"
: "${PRERELEASE:?true or false}"
: "${SKILLS_REPO_URL:?git URL of the skills repository, including credentials when pushing needs them}"
STORYBOOK_REF="${STORYBOOK_REF:-HEAD}"

STORYBOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="v$VERSION"
if [[ "$PRERELEASE" == "true" ]]; then
  BRANCH=next
else
  BRANCH=main
fi

CLONE_DIR=$(mktemp -d)
trap 'rm -rf "$CLONE_DIR"' EXIT

git clone --quiet --depth 1 --no-tags --branch "$BRANCH" "$SKILLS_REPO_URL" "$CLONE_DIR"
cd "$CLONE_DIR"
git config user.name "storybook-bot"
git config user.email "32066757+storybook-bot@users.noreply.github.com"

rm -rf skills
mkdir skills
git -C "$STORYBOOK_DIR" archive "$STORYBOOK_REF:code/lib/claude-plugin/skills" | tar -x -C skills
git add --all skills

if git diff --cached --quiet; then
  echo "skills/ on $BRANCH already matches storybook v$VERSION, tagging $(git rev-parse --short HEAD) as $TAG"
else
  git commit --quiet -m "Sync skills from storybook v$VERSION"
  echo "Committed $(git rev-parse --short HEAD) to $BRANCH, tagging it as $TAG"
fi

git tag "$TAG"
git push --quiet --atomic origin "$BRANCH" "$TAG"
