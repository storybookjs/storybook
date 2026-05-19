# shellcheck shell=bash
# Single source of truth for the secret env-vars that MUST be unset before
# any untrusted PR-head code (install / compile / recipe / unit tests) runs
# in verify-pr.yml. `source` this from the TRUSTED base checkout only:
#
#   source "$GITHUB_WORKSPACE/scripts/verify/ci/strip-untrusted-secrets.sh"
#
# It is sourced (not exec'd) so the unset takes effect in the calling step's
# shell. Adding a new secret to the workflow = one edit here, not N.
#
# C3: extended unset list. M2 note: VERIFY_PROVENANCE_SECRET no longer lives
# in $GITHUB_ENV, but unset is still defense-in-depth in case a future
# caller adds it. See RUNBOOK.md §verify-pr-secret-stripping.
unset GITHUB_TOKEN GH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN \
      ACTIONS_RUNTIME_TOKEN ACTIONS_ID_TOKEN_REQUEST_TOKEN \
      ACTIONS_ID_TOKEN_REQUEST_URL ACTIONS_RESULTS_URL ACTIONS_CACHE_URL \
      TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_URL \
      TELEMETRY_AGENTIC_VERIFICATION_WEBHOOK_TOKEN \
      VERIFY_PROVENANCE_SECRET
