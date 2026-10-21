#!/usr/bin/env bash
# Posts the failed jobs of a nightly `next` run to #sb-agility and asks Obvious to fix them.
set -euo pipefail

if [ "${CIRCLE_BRANCH:-}" != "next" ]; then
  echo "Only nightly runs on next are reported; this run is on ${CIRCLE_BRANCH:-an unknown branch}."
  exit 0
fi

: "${SLACK_SB_AGILITY_WEBHOOK_URL:?Set SLACK_SB_AGILITY_WEBHOOK_URL in the CircleCI project settings}"
: "${OBVIOUS_SLACK_USER_ID:?Set OBVIOUS_SLACK_USER_ID in the CircleCI project settings}"

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

text=$(
  printf ':rotating_light: The nightly `ci:daily` run on `next` failed at <https://github.com/storybookjs/storybook/commit/%s|%s>.\n\n%s\n\n<@%s> please fix these failures, or revert the PR that caused them if the fix is not straightforward. <%s|Open the workflow>' \
    "$CIRCLE_SHA1" "${CIRCLE_SHA1:0:7}" "$failed_jobs" "$OBVIOUS_SLACK_USER_ID" "$workflow_url"
)

jq -n --arg text "$text" '{text: $text}' |
  curl -sS --fail -X POST -H 'Content-Type: application/json' --data @- \
    -o /dev/null -w 'Slack responded with HTTP %{http_code}\n' "$SLACK_SB_AGILITY_WEBHOOK_URL"
