#!/usr/bin/env python3
"""Replace HTML-comment-delimited regions in a GitHub PR body.

Fetches the live PR body first so sequential marker updates cannot restore a
stale event-payload snapshot.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


def replace_marker(body: str, marker: str, replacement: str) -> str:
    pattern = rf"(<!-- {re.escape(marker)} -->)(.*?)(<!-- {re.escape(marker)} -->)"

    def repl(match: re.Match[str]) -> str:
        return f"{match.group(1)}\n{replacement}\n{match.group(3)}"

    updated, count = re.subn(pattern, repl, body, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"expected 1 {marker} pair, found {count}")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument(
        "--marker",
        action="append",
        nargs=2,
        metavar=("MARKER", "FILE"),
        required=True,
    )
    args = parser.parse_args()

    body = subprocess.check_output(
        ["gh", "api", f"repos/{args.repo}/pulls/{args.pr}", "--jq", ".body"],
        text=True,
    )
    if body.endswith("\n"):
        body = body[:-1]

    for marker, path in args.marker:
        replacement = Path(path).read_text().rstrip("\n")
        body = replace_marker(body, marker, replacement)

    subprocess.run(
        [
            "gh",
            "api",
            "--method",
            "PATCH",
            f"repos/{args.repo}/pulls/{args.pr}",
            "--input",
            "-",
        ],
        input=json.dumps({"body": body}),
        text=True,
        check=True,
    )


if __name__ == "__main__":
    main()
