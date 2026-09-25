#!/usr/bin/env bash
# Copies code/lib/claude-plugin/skills, as committed at STORYBOOK_REF, into the skills repository
# and tags it v$VERSION. Prereleases go to `next`, releases to `main`.
set -euo pipefail

: "${VERSION:?e.g. 11.0.0-alpha.3}"
: "${SKILLS_REPO_URL:?e.g. https://x-access-token:TOKEN@github.com/storybookjs/skills.git}"
STORYBOOK_REF="${STORYBOOK_REF:-HEAD}"

TAG="v$VERSION"
if [[ "$VERSION" == *-* ]]; then BRANCH=next; else BRANCH=main; fi
STORYBOOK_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

CLONE_DIR=$(mktemp -d)
trap 'rm -rf "$CLONE_DIR"' EXIT
git clone --quiet --depth 1 --no-tags --branch "$BRANCH" "$SKILLS_REPO_URL" "$CLONE_DIR"

rm -rf "$CLONE_DIR/skills"
git -C "$STORYBOOK_DIR" archive --prefix=skills/ "$STORYBOOK_REF:code/lib/claude-plugin/skills" | tar -x -C "$CLONE_DIR"
compgen -G "$CLONE_DIR/skills/*/SKILL.md" >/dev/null || { echo "No skills found at $STORYBOOK_REF" >&2; exit 1; }

cd "$CLONE_DIR"
git add --all skills
if git diff --cached --quiet; then
  echo "skills/ on $BRANCH already matches"
else
  git -c user.name=storybook-bot -c user.email=32066757+storybook-bot@users.noreply.github.com \
    commit --quiet -m "Sync skills from storybook v$VERSION"
fi
git tag "$TAG"
git push --quiet --atomic origin "$BRANCH" "$TAG"
echo "$BRANCH is at $(git rev-parse --short HEAD), tagged $TAG"
