#!/usr/bin/env bash
# Pick the remote branch the current branch most likely forked from.
# Supports telescoped/stacked PRs by scanning all origin/* ancestors.
set -euo pipefail

current_branch=$(git branch --show-current)
head_tip=$(git rev-parse HEAD)
best=""
min_commits=999999
best_is_feature=0

is_trunk() {
  case "$1" in
    main | next) return 0 ;;
    *) return 1 ;;
  esac
}

normalize_branch_name() {
  local name=$1
  name=${name#origin/}
  name=${name#remotes/origin/}
  echo "${name}"
}

branch_exists_on_origin() {
  git rev-parse --verify "origin/$1" >/dev/null 2>&1
}

is_valid_base() {
  local branch=$1
  local ref="origin/${branch}"

  [ "${branch}" != "${current_branch}" ] || return 1
  branch_exists_on_origin "${branch}" || return 1

  local branch_tip
  branch_tip=$(git rev-parse "${ref}")
  [ "${branch_tip}" != "${head_tip}" ] || return 1
  git merge-base --is-ancestor "${ref}" HEAD 2>/dev/null
}

commit_count_since() {
  git rev-list --count "origin/$1..HEAD"
}

consider() {
  local branch=$1
  local commit_count=$2

  if ! is_valid_base "${branch}"; then
    return
  fi

  local is_feature=0
  is_trunk "${branch}" || is_feature=1

  if [ -z "${best}" ]; then
    best=${branch}
    min_commits=${commit_count}
    best_is_feature=${is_feature}
    return
  fi

  if [ "${commit_count}" -lt "${min_commits}" ]; then
    best=${branch}
    min_commits=${commit_count}
    best_is_feature=${is_feature}
    return
  fi

  if [ "${commit_count}" -gt "${min_commits}" ]; then
    return
  fi

  # Tie: prefer telescoped parent over trunk, then next over main.
  if [ "${best_is_feature}" -eq 0 ] && [ "${is_feature}" -eq 1 ]; then
    best=${branch}
    best_is_feature=${is_feature}
    return
  fi

  if [ "${best_is_feature}" -eq 1 ] && [ "${is_feature}" -eq 0 ]; then
    return
  fi

  if [ "${branch}" = "next" ]; then
    best=${branch}
    best_is_feature=${is_feature}
  fi
}

try_explicit_base() {
  local branch=$1
  branch=$(normalize_branch_name "${branch}")
  consider "${branch}" "$(commit_count_since "${branch}")"
}

# 1. Tracked upstream (set when branching with -u or --track)
if upstream=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null); then
  try_explicit_base "${upstream}"
fi

# 2. Reflog: most recent branch we checked out from
if [ -z "${best}" ]; then
  while IFS= read -r line; do
    if [[ ${line} =~ checkout:\ moving\ from\ (.+)\ to\ ${current_branch} ]]; then
      try_explicit_base "${BASH_REMATCH[1]}"
      break
    fi
    if [[ ${line} =~ branch:\ Created\ from\ (.+) ]]; then
      try_explicit_base "${BASH_REMATCH[1]}"
      break
    fi
  done < <(git reflog show --format='%gs' "${current_branch}" 2>/dev/null || true)
fi

# 3. Scan all origin/* branches — closest strict ancestor wins
while IFS= read -r ref; do
  branch=${ref#origin/}

  if [ "${branch}" = "HEAD" ] || [ "${branch}" = "${current_branch}" ]; then
    continue
  fi

  if ! is_valid_base "${branch}"; then
    continue
  fi

  consider "${branch}" "$(commit_count_since "${branch}")"
done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin/)

if [ -z "${best}" ]; then
  best="next"
fi

echo "${best}"
