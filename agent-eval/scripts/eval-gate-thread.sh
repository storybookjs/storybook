#!/usr/bin/env bash
# Manage the bot-owned "Agent eval gate" review thread on a pull request.
#
# One persistent thread (located by the <!-- agent-eval-gate --> marker in its
# first comment) is the merge proof for the `agent-eval:eval` label: it is
# created or reopened when evals start, resolved only by a successful run of
# the current head, and reopened explicitly on synchronize (pushes do NOT
# auto-reopen resolved review threads). All GitHub access goes through the
# `gh` CLI; no additional actions are involved.
#
# Subcommands (configuration arrives via environment variables):
#
#   ensure   At eval start (PR runs, and dispatch runs with a resolvable PR).
#            Creates the thread (anchored to a changed file) or updates and
#            unresolves it. Any failure is fatal: without the thread there is
#            no merge proof for `agent-eval:eval`.
#            Env: PR_NUMBER, EVALUATED_HEAD_SHA, RUN_URL,
#                 SCOPE_LINE (optional; the active scope labels)
#
#   result   At the end of the eval job. On success for the live PR head:
#            body -> pass summary, thread resolved. Stale or failed:
#            body updated, thread stays open. Never fatal: warns and notes
#            the step summary instead (re-dispatch to retry).
#            Env: PR_NUMBER, EVALUATED_HEAD_SHA, RUN_URL, PLAYGROUND_URL,
#                 EVAL_OUTCOME, SUMMARY_FILE (optional rendered markdown)
#
#   reopen   pull_request synchronize with agent-eval:eval present. Unresolves
#            the thread and marks the new head as requiring evals, without
#            rerunning evals. Fatal on failure: a silently stale resolved
#            thread would count for a head that was never evaluated.
#            Env: PR_NUMBER, NEW_HEAD_SHA

set -euo pipefail

MARKER='<!-- agent-eval-gate -->'
OWNER="${GITHUB_REPOSITORY%%/*}"
REPO="${GITHUB_REPOSITORY#*/}"

need() { command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 1; }; }
need gh
need jq

# Emit a step output; also visible when testing outside Actions.
output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  else
    echo "$1"
  fi
}

# Locate the gate thread across all review-thread pages. Prints
# "thread_id comment_id is_resolved" (empty, exit 0 when absent).
# API failures exit non-zero so callers can distinguish them from "not found".
locate_thread() {
  local pr="$1"
  local query='query($owner:String!,$repo:String!,$pr:Int!,$cursor:String){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$pr){
        reviewThreads(first:100,after:$cursor){
          pageInfo{hasNextPage endCursor}
          nodes{id isResolved comments(first:1){nodes{id databaseId body}}}
        }
      }
    }
  }'
  local cursor="" response match has_next
  local cmd
  while :; do
    cmd=(gh api graphql -f query="$query" -f owner="$OWNER" -f repo="$REPO" -F pr="$pr")
    [[ -n "$cursor" ]] && cmd+=(-f cursor="$cursor")
    response="$("${cmd[@]}")"
    match="$(jq -c --arg marker "$MARKER" \
      '[.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.comments.nodes[0].body | contains($marker))][0]' <<<"$response")"
    if [[ -n "$match" && "$match" != "null" ]]; then
      jq -r '[.id, (.comments.nodes[0].databaseId | tostring), (.isResolved | tostring)] | join(" ")' <<<"$match"
      return 0
    fi
    has_next="$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<<"$response")"
    [[ "$has_next" == "true" ]] || return 0
    cursor="$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor' <<<"$response")"
  done
}

# First changed file that still exists in the diff (review comments need a
# live file path; removed files cannot anchor threads). Fatal when absent.
pick_anchor_path() {
  local pr="$1" anchor=""
  anchor="$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$pr/files?per_page=100" \
    --jq '.[] | select(.status != "removed") | .filename' | head -n1 || true)"
  if [[ -z "$anchor" ]]; then
    anchor="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr/files?per_page=100" \
      --jq '.[0].filename // empty' || true)"
  fi
  if [[ -z "$anchor" ]]; then
    echo "::error title=Eval gate::Cannot anchor the gate thread: PR #$pr has no changed files." >&2
    exit 1
  fi
  printf '%s' "$anchor"
}

# REST create: file-level review comment. subject_type must be lowercase,
# commit_id (PR head SHA) is required, and no line/positioning.
create_comment() {
  local pr="$1" sha="$2" path="$3" body="$4" payload id
  payload="$(jq -n --arg body "$body" --arg path "$path" --arg sha "$sha" \
    '{body: $body, path: $path, commit_id: $sha, subject_type: "file"}')"
  if ! id="$(printf '%s' "$payload" | gh api --method POST "repos/$GITHUB_REPOSITORY/pulls/$pr/comments" --input - --jq '.id')"; then
    echo "::error title=Eval gate::Creating the gate review thread on PR #$pr failed. Without it there is no merge proof for agent-eval:eval." >&2
    exit 1
  fi
  printf '%s' "$id"
}

update_comment() { # comment_id body -> 0/1 (callers decide fatal vs warn)
  printf '%s' "$2" | gh api --method PATCH "repos/$GITHUB_REPOSITORY/pulls/comments/$1" --input - --silent >/dev/null
}

resolve_thread() {
  gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id}}}' -f id="$1" >/dev/null
}

unresolve_thread() {
  gh api graphql -f query='mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id}}}' -f id="$1" >/dev/null
}

cmd_ensure() {
  local pr="$PR_NUMBER" sha="$EVALUATED_HEAD_SHA"
  local run_url="${RUN_URL:-n/a}"
  local scope_label found thread_id comment_id resolved body

  if [[ -n "${SCOPE_LINE:-}" ]]; then
    scope_label="\`agent-eval:eval\` + $SCOPE_LINE"
  else
    scope_label="\`agent-eval:eval\` (default smoke)"
  fi

  body="$(printf '%s\n' \
    "$MARKER" \
    '### Agent eval gate' \
    '' \
    "**Status: evals required for head \`${sha:0:7}\`** (this comment is maintained by the Agent eval workflow)." \
    '' \
    "- Scope: $scope_label" \
    "- Eval run: $run_url" \
    '' \
    'This bot-owned thread is the merge proof for the `agent-eval:eval` label: it resolves only when a successful eval run has evaluated the current PR head, and it reopens when new commits land. Rerun evals by removing and re-adding `agent-eval:eval`, or via `workflow_dispatch` (set `pr_number` if the branch is ambiguous).')"

  if ! found="$(locate_thread "$pr")"; then
    echo "::error title=Eval gate::Locating the gate thread on PR #$pr failed (GraphQL error)." >&2
    exit 1
  fi

  if [[ -n "$found" ]]; then
    read -r thread_id comment_id resolved <<<"$found"
    update_comment "$comment_id" "$body" || {
      echo "::error title=Eval gate::Updating the gate thread body on PR #$pr failed." >&2
      exit 1
    }
    # Reuse is create-or-update: an old resolved thread must be open again
    # before evals run (resolving later is an idempotent no-op).
    if [[ "$resolved" == "true" ]]; then
      unresolve_thread "$thread_id" || {
        echo "::error title=Eval gate::Could not unresolve the stale gate thread on PR #$pr." >&2
        exit 1
      }
    fi
  else
    comment_id="$(create_comment "$pr" "$sha" "$(pick_anchor_path "$pr")" "$body")"
    found="$(locate_thread "$pr" || true)"
    thread_id="${found%% *}"
  fi
  output "thread_id=$thread_id"
  output "comment_id=$comment_id"
}

cmd_result() {
  local pr="$PR_NUMBER" sha="$EVALUATED_HEAD_SHA" outcome="${EVAL_OUTCOME:-unknown}"
  local run_url="${RUN_URL:-}" playground="${PLAYGROUND_URL:-}"
  local found thread_id comment_id resolved summary="" body current_head

  if ! found="$(locate_thread "$pr")"; then
    echo "::warning title=Eval gate::Locating the gate thread on PR #$pr failed; leaving it untouched."
    return 0
  fi
  if [[ -z "$found" ]]; then
    echo "::warning title=Eval gate::No gate thread found on PR #$pr (deleted by a human?); skipping the result update."
    return 0
  fi
  read -r thread_id comment_id resolved <<<"$found"

  if [[ -n "${SUMMARY_FILE:-}" && -s "$SUMMARY_FILE" ]]; then
    summary="$(cat "$SUMMARY_FILE")"
  fi

  if [[ "$outcome" == "success" ]]; then
    if ! current_head="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$pr" --jq .head.sha)"; then
      echo "::warning title=Eval gate::Could not fetch the live PR head; leaving the gate thread open."
      return 0
    fi

    if [[ "$current_head" == "$sha" ]]; then
      if [[ -n "$summary" ]]; then
        body="$(printf '%s\n' "$MARKER" '### Agent eval gate' '' \
          "**Status: passed for head \`${sha:0:7}\`** — this thread resolves automatically." \
          '' "$summary")"
      else
        body="$(printf '%s\n' "$MARKER" '### Agent eval gate' '' \
          "**Status: passed for head \`${sha:0:7}\`** — this thread resolves automatically." \
          '' \
          "- Eval run: ${run_url:-n/a}" \
          "- Playground: ${playground:-not deployed}")"
      fi
      update_comment "$comment_id" "$body" \
        || echo "::warning title=Eval gate::Could not update the gate thread body (comment $comment_id)."
      # Resolving an already-resolved thread is a no-op success.
      if ! resolve_thread "$thread_id"; then
        echo "::warning title=Eval gate::Resolving the gate thread failed (resolveReviewThread needs contents:write + pull-requests:write). Re-dispatch the Agent eval workflow to retry."
        {
          echo '### Eval gate thread'
          echo
          echo "- The eval run passed for head \`${sha:0:7}\`, but resolving the gate thread failed. Re-dispatch the Agent eval workflow to retry (or resolve the thread manually)."
        } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
      fi
      output "result=resolved"
      return 0
    fi

    # Success, but a newer head landed since checkout: the result is stale.
    body="$(printf '%s\n' "$MARKER" '### Agent eval gate' '' \
      "**Status: stale — evals passed for head \`${sha:0:7}\`, but the PR head is now \`${current_head:0:7}\`.**" \
      '' \
      'Evals are required again for the new head. Rerun by removing and re-adding `agent-eval:eval`, or via `workflow_dispatch`.' \
      '' \
      "- Eval run: ${run_url:-n/a}" \
      "- Playground: ${playground:-not deployed}")"
    update_comment "$comment_id" "$body" \
      || echo "::warning title=Eval gate::Could not mark the gate thread stale (comment $comment_id)."
    output "result=stale"
    return 0
  fi

  # failure / cancelled / skipped: keep the thread open with links.
  body="$(printf '%s\n' "$MARKER" '### Agent eval gate' '' \
    "**Status: evals did not pass (outcome: \`$outcome\`) for head \`${sha:0:7}\`** — this thread stays open." \
    '' \
    "- Eval run: ${run_url:-n/a}" \
    "- Playground: ${playground:-not deployed}" \
    '' \
    'Rerun by removing and re-adding `agent-eval:eval`, or via `workflow_dispatch`.')"
  update_comment "$comment_id" "$body" \
    || echo "::warning title=Eval gate::Could not record the failure on the gate thread (comment $comment_id)."
  output "result=open"
}

cmd_reopen() {
  local pr="$PR_NUMBER" sha="$NEW_HEAD_SHA"
  local found thread_id comment_id resolved body

  if ! found="$(locate_thread "$pr")"; then
    echo "::error title=Eval gate::Locating the gate thread on PR #$pr failed (GraphQL error)." >&2
    exit 1
  fi
  if [[ -z "$found" ]]; then
    echo "No eval gate thread on PR #$pr (evals never started); nothing to reopen."
    return 0
  fi
  read -r thread_id comment_id resolved <<<"$found"

  body="$(printf '%s\n' "$MARKER" '### Agent eval gate' '' \
    "**Status: evals required for new head \`${sha:0:7}\`** — a new push was detected; previous eval results no longer cover this head (evals were not rerun)." \
    '' \
    'Rerun evals by removing and re-adding `agent-eval:eval`, or via `workflow_dispatch` (set `pr_number` if the branch is ambiguous).')"

  update_comment "$comment_id" "$body" || {
    echo "::error title=Eval gate::Could not update the gate thread on PR #$pr after the new push." >&2
    exit 1
  }
  if [[ "$resolved" == "true" ]]; then
    unresolve_thread "$thread_id" || {
      echo "::error title=Eval gate::Could not reopen the gate thread on PR #$pr (pushes do not auto-reopen resolved threads; a stale resolved thread would wrongly count for the new head)." >&2
      exit 1
    }
  fi
  output "reopened=true"
}

case "${1:-}" in
  ensure) cmd_ensure ;;
  result) cmd_result ;;
  reopen) cmd_reopen ;;
  *) echo "usage: $0 {ensure|result|reopen}" >&2; exit 2 ;;
esac
