---
# Report formatting guidelines
---

## Report Structure Guidelines

### 1. Header Levels
**Use h3 (###) or lower for all headers in your issue report to maintain proper document hierarchy.**

When creating GitHub issues or discussions:
- Use `###` (h3) for main sections (e.g., "### Test Summary")
- Use `####` (h4) for subsections (e.g., "#### Device-Specific Results")
- Never use `##` (h2) or `#` (h1) in reports - these are reserved for titles

### 2. Progressive Disclosure
**Wrap detailed test results in `<details><summary><b>Section Name</b></summary>` tags to improve readability and reduce scrolling.**

Use collapsible sections for:
- Verbose details (full test logs, raw data)
- Secondary information (minor warnings, extra context)
- Per-item breakdowns when there are many items

Always keep critical information visible (summary, critical issues, key metrics).

### 3. Report Structure Pattern

1. **Overview**: 1-2 paragraphs summarizing key findings
2. **Critical Information**: Show immediately (summary stats, critical issues)
3. **Details**: Use `<details><summary><b>Section Name</b></summary>` for expanded content
4. **Context**: Add helpful metadata (workflow run, date, trigger)

### Design Principles (Airbnb-Inspired)

Reports should:
- **Build trust through clarity**: Most important info immediately visible
- **Exceed expectations**: Add helpful context like trends, comparisons
- **Create delight**: Use progressive disclosure to reduce overwhelm
- **Maintain consistency**: Follow patterns across all reports

### Example Report Structure

```markdown
### Summary
- Key metric 1: value
- Key metric 2: value
- Status: ✅/⚠️/❌

### Critical Issues
[Always visible - these are important]

<details>
<summary><b>View Detailed Results</b></summary>

[Comprehensive details, logs, traces]

</details>

<details>
<summary><b>View All Warnings</b></summary>

[Minor issues and potential problems]

</details>

### Recommendations
[Actionable next steps - keep visible]
```

## Workflow Run References

- Format run IDs as links: `[§12345](https://github.com/owner/repo/actions/runs/12345)`
- Include up to 3 most relevant run URLs at end under `**References:**`
- Do NOT add footer attribution (system adds automatically)
