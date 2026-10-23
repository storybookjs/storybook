#!/usr/bin/env bash
# Posts the failed jobs of a nightly `next` run to #sb-agility and, on weekdays, asks Obvious to fix them.
set -euo pipefail

# Whoever reruns a workflow by hand is already looking at it, and CircleCI tags reruns.
rerun=$(curl -sS --fail "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}" | jq -r '.tag // ""')
if [[ "$rerun" == rerun-* ]]; then
  echo "Not reporting a manual rerun ($rerun)."
  exit 0
fi

workflow_url="https://app.circleci.com/pipelines/github/storybookjs/storybook/${PIPELINE_NUMBER}/workflows/${CIRCLE_WORKFLOW_ID}"

failed_jobs=$(
  curl -sS --fail "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/job" |
    jq -r --arg url "$workflow_url" '
      .items[]
      | select(.status | IN("failed", "timedout", "infrastructure_fail", "terminated-unknown"))
      | "• <\($url)/jobs/\(.job_number)|\(.name)>"'
)

if [ -z "$failed_jobs" ]; then
  echo "No failed jobs."
  exit 0
fi

: "${SLACK_SB_AGILITY_WEBHOOK_URL:?Set SLACK_SB_AGILITY_WEBHOOK_URL in the CircleCI project settings}"

# Nobody follows up on Obvious's work on weekends, so a Saturday or Sunday report only lists the
# failures; Monday's report asks Obvious if they still fail.
if [ "$(date -u +%u)" -ge 6 ]; then
  request=''
else
  : "${OBVIOUS_SLACK_USER_ID:?Set OBVIOUS_SLACK_USER_ID in the CircleCI project settings}"
  request="<@${OBVIOUS_SLACK_USER_ID}> please fix these failures, or revert the PR that caused them if the fix is not straightforward. "
fi

text=$(
  printf ':rotating_light: The nightly `ci:daily` run on `next` failed at <https://github.com/storybookjs/storybook/commit/%s|%s>.\n\n%s\n\n%s<%s|Open the workflow>' \
    "$CIRCLE_SHA1" "${CIRCLE_SHA1:0:7}" "$failed_jobs" "$request" "$workflow_url"
)

jq -n --arg text "$text" '{text: $text}' |
  curl -sS --fail -X POST -H 'Content-Type: application/json' --data @- \
    -o /dev/null -w 'Slack responded with HTTP %{http_code}\n' "$SLACK_SB_AGILITY_WEBHOOK_URL"
