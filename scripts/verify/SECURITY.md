# Verify Harness — Security Model

## Threat Model

The verify harness accepts external PR diffs, story content, and repo README text as inputs. Each of these surfaces is a potential prompt-injection vector where a malicious contributor could embed instructions intended to manipulate the Claude-powered reviewer.

**Lethal-trifecta breakers** — at least one must hold to prevent a catastrophic injection:

1. **Limit network access** — block outbound calls so exfiltration is impossible even if the agent is hijacked.
2. **Limit data access** — restrict what files and credentials the agent can read/write.
3. **Require human review of spec diff** — ensure a trusted human has reviewed the verification spec before it runs.

The Phase-1 PoC chooses **option 3**: every verification spec is committed to `.verify-recipes/<pr#>.spec.ts` and reviewed as part of the normal PR review process before the harness executes it. Options 1 and 2 are enforced additionally via `.claude/settings.json` deny rules and the `.dockerignore` exclusion list.

---

## Phase 1 — Local PoC (current increment)

### Spec review gate

Before the harness runs, the spec file must be committed to `.verify-recipes/<pr#>.spec.ts`. Standard GitHub PR review covers the spec content, ensuring a trusted contributor has approved what the agent will execute.

### `.claude/settings.json` permission rules

The file `.claude/settings.json` at the repo root enforces allow/deny rules for all Claude Code agent actions. Key deny entries:

```json
"deny": [
  "Bash(curl *)",
  "Bash(wget *)",
  "Bash(rm -rf /*)",
  "Bash(rm -rf ~/**)",
  "Bash(sudo *)",
  "Write(.env)",
  "Write(.env.*)",
  "Write(**/.env)",
  "Write(**/.env.*)",
  "Write(~/.ssh/**)",
  "Write(~/.aws/**)",
  "Write(~/.config/**)",
  "Write(~/.git-credentials)",
  "Write(**/*.pem)",
  "Write(**/*.key)",
  "Read(.env)",
  "Read(~/.ssh/**)",
  "Read(~/.aws/**)"
]
```

See `.claude/settings.json` for the full allow list.

### Spec linting gate

Before executing a spec, lint it:

```bash
yarn --cwd code lint:js:cmd ../.verify-recipes/<pr#>.spec.ts --fix
```

A lint failure aborts the run. This prevents obviously malformed or injected specs from reaching the execution layer.

### Deferred: `@anthropic-ai/sandbox-runtime` evaluation

Evaluation of `@anthropic-ai/sandbox-runtime` as an additional isolation layer is **postponed to Phase 2**. Tracked as a follow-up item. Do not attempt the spike in Phase 1.

---

## Phase 2 — CI Action (deferred)

### Container shape

```
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,size=100m \
  --tmpfs /workspace/.verify-output:rw,size=500m \
  --network none \
  --memory 4g \
  --pids-limit 200 \
  --user 1000:1000 \
  -v $WORKSPACE:/workspace:ro \
  verify-harness:<pinned-sha>
```

### Credential proxy

An Envoy proxy runs outside the container with a `credential_injector` filter. The allowlist permits only `api.anthropic.com` and `api.github.com`. The container reaches the proxy via `ANTHROPIC_BASE_URL=http://proxy:8080`; no API key is injected inside the container itself.

### Workflow trigger

- Trigger: `pull_request_target` + label `ci:verify`
- Actor gate: `check-actor-permissions-action` with `permission: write`
- Concurrency: `group: verify-${pr.number}`, `cancel-in-progress: true`
- Permissions: `pull-requests: write`, `statuses: write` only
- Artifacts: `actions/upload-artifact` with `if: always()`, retention 14 days, name includes `pr#` and `run-id`

---

## Phase 3 — Default trigger (deferred)

- Auto-trigger for contributors with `OWNER`, `MEMBER`, or `COLLABORATOR` `author_association`
- External PRs require explicit label `ci:verify`
- NX affected detection prunes the verification set to only changed packages

---

## Defense-in-depth NOT taken (rationale)

| Technique | Reason rejected |
|-----------|----------------|
| gVisor | 10–200× I/O overhead; unacceptable for a harness that builds and runs Storybook |
| Firecracker | Overkill; container + `--network=none` provides adequate isolation |
| TLS-terminating proxy | Domain-fronting residual risk accepted — allowlist endpoints are Cloudflare-fronted; full TLS termination adds complexity without eliminating the risk |

---

## Sensitive-file exclusion table

Paths excluded by `.dockerignore` and/or `.claude/settings.json` deny rules:

| Path | Reason | Enforcement |
|------|--------|-------------|
| `.env` | Contains local secrets and API keys | both |
| `.env.*` | Environment-specific secret overrides | both |
| `**/.env` | Nested env files in monorepo packages | both |
| `**/.env.*` | Nested env variant files | both |
| `~/.ssh/` | SSH private keys and known hosts | both |
| `~/.aws/` | AWS credentials and config | both |
| `~/.config/gcloud/` | GCP credentials | `.dockerignore` |
| `~/.azure/` | Azure credentials | `.dockerignore` |
| `~/.docker/config.json` | Docker registry auth tokens | `.dockerignore` |
| `~/.kube/config` | Kubernetes cluster credentials | `.dockerignore` |
| `.npmrc` | npm auth tokens | `.dockerignore` |
| `.pypirc` | PyPI credentials | `.dockerignore` |
| `**/*-service-account.json` | GCP service account key files | `.dockerignore` |
| `**/*.pem` | TLS/SSL certificates and private keys | both |
| `**/*.key` | Private key files | both |
| `~/.git-credentials` | Git credential store | both |
| `~/.config/**` | General user config (may contain tokens) | `.claude/settings.json deny` |

Row count: **17**

---

## Isolation tech matrix

| Technology | Mechanism | Verdict |
|------------|-----------|---------|
| Linux namespaces + cgroups (Docker `--cap-drop ALL`, `--network none`) | Kernel-level process and network isolation; read-only root filesystem; pid and memory limits | **Chosen — Phase 2** |
| gVisor | Intercepts syscalls via user-space kernel; stronger isolation boundary | Rejected — 10–200× I/O overhead unacceptable |
| Firecracker | Lightweight VMM with hardware-virtualized isolation | Rejected — overkill; container isolation is sufficient |

---

## Verification

Confirm that `.claude/settings.json` deny rules are enforced:

```bash
jq '.permissions.deny[]' .claude/settings.json
```

Expected output lists all deny patterns (curl, wget, rm -rf, sudo, .env paths, SSH/AWS/config paths, credential files, PEM/key files).
